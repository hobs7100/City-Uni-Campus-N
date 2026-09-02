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

  // Fetch current status before the update so we can detect reactivation.
  const current = await queryOne<{ status: string; class_id: string }>(
    `select status, class_id from students where id = $1 and deleted_at is null`,
    [id]
  );
  if (!current) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const isReactivation = d.status === "active" && current.status === "struck_off";

  const { password, ...rest } = d;
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
  // When status changes, record who made the change
  if (d.status !== undefined) {
    sets.push(`status_changed_by_name = $${i++}`);
    values.push(session!.name);
  }
  // On reactivation: reset the protection-window timestamp so the auto struck-off
  // service waits for 10 new coordinator-marked days before evaluating again.
  if (isReactivation) {
    sets.push(`reactivated_at = now()`);
  } else if (d.status && d.status !== "active") {
    // Any non-active status clears the reactivation timestamp
    sets.push(`reactivated_at = NULL`);
  }
  // Note: status_change_date and status_change_semester come through the loop above
  // already set to null by the frontend for active/struck_off — no duplicate block needed.
  sets.push("updated_at = now()");
  values.push(id);

  const evalClient = await pool.connect();
  let student: { id: string; name: string; email: string; status: string } | null = null;
  try {
    await evalClient.query("begin");
    const res = await evalClient.query<{ id: string; name: string; email: string; status: string }>(
      `update students set ${sets.join(", ")} where id = $${i} and deleted_at is null returning id, name, email, status`,
      values
    );
    student = res.rows[0] ?? null;
    if (!student) {
      await evalClient.query("rollback");
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
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
            ? "Manually reactivated — new 10-day protection window started"
            : `Status manually changed to ${d.status}`,
          actorRole,
        ]
      );
    }
    await evalClient.query("commit");
  } catch (err) {
    await evalClient.query("rollback");
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
