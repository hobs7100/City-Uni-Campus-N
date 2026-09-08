import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requirePortalPermission } from "@/lib/portalPermissions";

const schema = z.object({
  name: z.string().min(2).optional(),
  father_name: z.string().optional().nullable(),
  cnic: z.string().min(5).optional(),
  contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  department_id: z.string().uuid().optional(),
  session: z.string().min(1).optional(),
  class_id: z.string().uuid().optional(),
  profile_image_url: z.string().optional().nullable(),
  status: z.enum(["active", "struck_off", "left", "dropped", "freezed", "permanent_leave"]).optional(),
  status_change_date: z.string().optional().nullable(),
  status_change_semester: z.coerce.number().optional().nullable(),
  fine_amount: z.coerce.number().positive().optional(),
  fid: z.string().trim().min(1).max(100).optional(),
  reactivation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePortalPermission("students", "edit", "admin", "hod", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  // Assistants cannot change a student's status.
  if (session!.role === "assistant" && d.status !== undefined) {
    return NextResponse.json({ error: "Assistants are not permitted to change student status." }, { status: 403 });
  }

  if (d.cnic) {
    const existing = await queryOne(`select id from students where cnic = $1 and id != $2`, [d.cnic, id]);
    if (existing) return NextResponse.json({ error: "A student with this CNIC already exists." }, { status: 409 });
  }
  if (d.email) {
    const existing = await queryOne(`select id from students where email = $1 and id != $2`, [
      d.email.toLowerCase(), id,
    ]);
    if (existing) return NextResponse.json({ error: "A student with this email already exists." }, { status: 409 });
  }

  const evalClient = await pool.connect();
  let student: { id: string; name: string; email: string; status: string } | null = null;
  try {
    await evalClient.query("begin");
    // Lock the placement before deciding whether this request is a reactivation.
    // This prevents competing requests from both recording a fine for one student.
    const currentResult = await evalClient.query<{
      status: string;
      class_id: string;
      department_id: string;
      semester_id: string | null;
    }>(
      `select st.status, st.class_id, st.department_id,
              coalesce(
                (select s.id from semesters s
                 where s.class_id = st.class_id and s.status in ('active', 'mid_term')
                 order by case s.status when 'mid_term' then 0 else 1 end limit 1),
                (select s.id from semesters s
                 where s.class_id = st.class_id
                   and s.semester_number = st.status_change_semester
                 order by s.created_at desc limit 1)
              ) as semester_id
       from students st where st.id = $1 and st.deleted_at is null
       for update`,
      [id],
    );
    const current = currentResult.rows[0];
    if (!current) {
      await evalClient.query("rollback");
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const isReactivation = d.status === "active" && current.status === "struck_off";
    if (isReactivation && (d.class_id !== undefined || d.department_id !== undefined)) {
      await evalClient.query("rollback");
      return NextResponse.json(
        { error: "Class and department cannot be changed while reactivating a struck-off student." },
        { status: 409 },
      );
    }
    if (isReactivation && (!d.fine_amount || !d.fid || !d.reactivation_date)) {
      await evalClient.query("rollback");
      return NextResponse.json(
        { error: "Fine Amount, FID, and activation date are required to reactivate a struck-off student." },
        { status: 400 },
      );
    }
    if (isReactivation && !current.semester_id) {
      await evalClient.query("rollback");
      return NextResponse.json(
        { error: "No semester could be identified for this fine transaction." },
        { status: 409 },
      );
    }

    const { password, fine_amount, fid, reactivation_date, ...rest } = d;
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      sets.push(`${key} = $${i++}`);
      values.push(key === "email" && typeof value === "string" ? value.toLowerCase() : value);
    }
    if (password) {
      sets.push(`password_hash = $${i++}`);
      values.push(await hashPassword(password));
    }
    if (d.status !== undefined) {
      sets.push(`status_changed_by_name = $${i++}`);
      values.push(session!.name);
    }
    if (isReactivation) {
      sets.push(`reactivated_at = $${i++}::date`);
      values.push(reactivation_date);
      sets.push("status_change_date = NULL");
      sets.push("status_change_semester = NULL");
    } else if (d.status && d.status !== "active") {
      sets.push("reactivated_at = NULL");
    }
    sets.push("updated_at = now()");
    values.push(id);

    const statusCondition = isReactivation ? " and status = 'struck_off'" : "";
    const res = await evalClient.query<{ id: string; name: string; email: string; status: string }>(
      `update students set ${sets.join(", ")}
       where id = $${i} and deleted_at is null${statusCondition}
       returning id, name, email, status`,
      values,
    );
    student = res.rows[0] ?? null;
    if (!student) {
      await evalClient.query("rollback");
      return NextResponse.json(
        { error: isReactivation ? "Student is no longer struck off." : "Student not found." },
        { status: isReactivation ? 409 : 404 },
      );
    }
    // Log status changes to the audit history with the real actor role
    if (d.status !== undefined && d.status !== current.status) {
      const actorRole =
        session!.role === "hod"         ? "HOD"
        : session!.role === "coordinator" ? "COORDINATOR"
        : "ADMIN";
      await evalClient.query(
        `insert into student_status_history
           (student_id, previous_status, new_status, reason, triggered_by)
         values ($1, $2, $3, $4, $5)`,
        [
          id,
          current.status,
          d.status,
          isReactivation
            ? `Manually reactivated from ${reactivation_date} — new 15-working-day protection window started`
            : `Status manually changed to ${d.status}`,
          actorRole,
        ]
      );
    }
    if (isReactivation) {
      await evalClient.query(
        `insert into student_fines
           (student_id, department_id, class_id, semester_id, amount, fid,
            paid_date, reactivated_on, created_by_name)
         values ($1, $2, $3, $4, $5, $6, $7::date, $7::date, $8)`,
        [
          id,
          current.department_id,
          current.class_id,
          current.semester_id,
          fine_amount,
          fid,
          reactivation_date,
          session!.name,
        ],
      );
    }
    await evalClient.query("commit");
  } catch (err) {
    await evalClient.query("rollback");
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This FID has already been used." }, { status: 409 });
    }
    throw err;
  } finally {
    evalClient.release();
  }

  return NextResponse.json({ student });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePortalPermission("students", "delete", "admin", "coordinator");
  if (response) return response;
  const { id } = await params;
  await query(`update students set deleted_at = now() where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
