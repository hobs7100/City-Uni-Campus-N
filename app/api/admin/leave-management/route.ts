import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// ── GET /api/admin/leave-management ──────────────────────────────────────────
// Returns all leave records (active + revoked), newest first.
export async function GET() {
  const { response } = await requireRole("admin");
  if (response) return response;

  const leaves = await query<{
    id: string;
    student_id: string;
    student_name: string;
    father_name: string | null;
    cnic: string;
    class_name: string;
    session: string;
    department_name: string;
    issue_date: string;
    reason: string | null;
    notes: string | null;
    proof_urls: string[];
    leave_type: "permanent" | "partial";
    partial_days_per_week: number | null;
    issued_by_name: string | null;
    revoked_at: string | null;
    created_at: string;
  }>(
    `select
       sl.id,
       s.id              as student_id,
       s.name            as student_name,
       s.father_name,
       s.cnic,
       cl.class_name,
       cl.session,
       d.name            as department_name,
       to_char(sl.issue_date, 'YYYY-MM-DD') as issue_date,
       sl.reason,
       sl.notes,
       sl.proof_urls,
       sl.leave_type,
       sl.partial_days_per_week,
       u.name            as issued_by_name,
       sl.revoked_at,
       sl.created_at
     from student_leaves sl
     join students s    on s.id  = sl.student_id
     join classes cl    on cl.id = s.class_id
     join departments d on d.id  = s.department_id
     left join users u  on u.id  = sl.issued_by
     order by sl.created_at desc`,
    []
  );

  return NextResponse.json({ leaves });
}

// ── POST /api/admin/leave-management ─────────────────────────────────────────
const postSchema = z.object({
  student_id: z.string().uuid(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leave_type: z.enum(["permanent", "partial"]),
  partial_days_per_week: z.union([z.literal(2), z.literal(3)]).optional().nullable(),
  reason:     z.string().optional().nullable(),
  notes:      z.string().optional().nullable(),
  proof_urls: z.array(z.string().url()).max(3).default([]),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const d = parsed.data;
  if (d.leave_type === "partial" && !d.partial_days_per_week)
    return NextResponse.json({ error: "Partial leave requires 2 or 3 approved days per week." }, { status: 400 });
  if (d.leave_type === "permanent" && d.partial_days_per_week != null)
    return NextResponse.json({ error: "Permanent leave cannot include approved days per week." }, { status: 400 });

  // Verify student exists
  const student = await queryOne<{ id: string; name: string; status: string }>(
    `select id, name, status from students where id = $1 and deleted_at is null`,
    [d.student_id]
  );
  if (!student)
    return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Lock the student so simultaneous requests cannot create multiple active leaves.
    const lockedStudent = await client.query<{ status: string }>(
      `select status from students where id = $1 and deleted_at is null for update`,
      [d.student_id],
    );
    if (!lockedStudent.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }
    const activeLeave = await client.query(
      `select id from student_leaves where student_id = $1 and revoked_at is null limit 1`,
      [d.student_id],
    );
    if (activeLeave.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "This student already has an active leave." }, { status: 409 });
    }
    if (d.leave_type === "partial" && lockedStudent.rows[0].status !== "active") {
      await client.query("rollback");
      return NextResponse.json({ error: "Partial leave can only be issued to an active student." }, { status: 409 });
    }

    // 1. Create leave record
    const leave = await client.query(
      `insert into student_leaves
         (student_id, issue_date, leave_type, partial_days_per_week, reason, notes, proof_urls, issued_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id`,
      [d.student_id, d.issue_date, d.leave_type, d.partial_days_per_week ?? null,
        d.reason ?? null, d.notes ?? null, d.proof_urls, session!.userId]
    );

    if (d.leave_type === "permanent") {
      // 2. Update student status to permanent_leave
      await client.query(
        `update students
         set status = 'permanent_leave',
             status_change_date = $1,
             status_changed_by_name = $2,
             reactivated_at = NULL,
             updated_at = now()
         where id = $3`,
        [d.issue_date, session!.name, d.student_id]
      );

      // 3. Audit trail
      await client.query(
        `insert into student_status_history
           (student_id, previous_status, new_status, reason, triggered_by)
         values ($1, $2, 'permanent_leave', 'Permanent leave issued', 'ADMIN')`,
        [d.student_id, lockedStudent.rows[0].status]
      );
    }

    await client.query("commit");
    return NextResponse.json({ ok: true, id: leave.rows[0].id });
  } catch (err) {
    await client.query("rollback");
    console.error("Leave issue error:", err);
    return NextResponse.json({ error: "Failed to issue leave." }, { status: 500 });
  } finally {
    client.release();
  }
}
