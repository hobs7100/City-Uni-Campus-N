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
    leave_type: "permanent" | "partial" | "monthly";
    partial_days_per_week: number | null;
    leave_start_date: string | null;
    leave_end_date: string | null;
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
       to_char(sl.leave_start_date, 'YYYY-MM-DD') as leave_start_date,
       to_char(sl.leave_end_date, 'YYYY-MM-DD') as leave_end_date,
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
  leave_type: z.enum(["permanent", "partial", "monthly"]),
  partial_days_per_week: z.union([z.literal(2), z.literal(3)]).optional().nullable(),
  leave_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  leave_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
  if (d.leave_type === "monthly" && (!d.leave_start_date || !d.leave_end_date))
    return NextResponse.json({ error: "Monthly leave requires both a start date and an end date." }, { status: 400 });
  if (d.leave_type === "monthly" && d.leave_start_date! > d.leave_end_date!)
    return NextResponse.json({ error: "Monthly leave end date cannot be before its start date." }, { status: 400 });
  if (d.leave_type !== "monthly" && (d.leave_start_date || d.leave_end_date))
    return NextResponse.json({ error: "A leave date range is only valid for Monthly Leave." }, { status: 400 });

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
      `select id from student_leaves
       where student_id = $1 and revoked_at is null
         and (
           leave_type in ('permanent', 'partial')
           or $2::varchar <> 'monthly'
           or daterange(leave_start_date, leave_end_date, '[]')
              && daterange($3::date, $4::date, '[]')
         )
       limit 1`,
      [d.student_id, d.leave_type, d.leave_start_date ?? d.issue_date, d.leave_end_date ?? d.issue_date],
    );
    if (activeLeave.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "This student already has an active leave." }, { status: 409 });
    }
    if (d.leave_type !== "permanent" && lockedStudent.rows[0].status !== "active") {
      await client.query("rollback");
      return NextResponse.json({ error: "Partial leave can only be issued to an active student." }, { status: 409 });
    }

    // 1. Create leave record
    const leave = await client.query(
      `insert into student_leaves
         (student_id, issue_date, leave_type, partial_days_per_week, leave_start_date, leave_end_date,
          reason, notes, proof_urls, issued_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id`,
      [d.student_id, d.issue_date, d.leave_type, d.partial_days_per_week ?? null,
        d.leave_start_date ?? null, d.leave_end_date ?? null,
        d.reason ?? null, d.notes ?? null, d.proof_urls, session!.userId]
    );

    if (d.leave_type === "monthly") {
      // The leave may be issued after attendance was already entered. Normalize
      // only records inside the approved range; outside dates remain untouched.
      await client.query(
        `update student_attendance_records
         set status = 'leave', updated_at = now()
         where student_id = $1 and attendance_date between $2 and $3`,
        [d.student_id, d.leave_start_date, d.leave_end_date]
      );
      await client.query(
        `update student_course_attendance
         set status = 'leave', updated_at = now()
         where student_id = $1 and attendance_date between $2 and $3`,
        [d.student_id, d.leave_start_date, d.leave_end_date]
      );
    }

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
