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
// Issue a permanent leave for a student.
const postSchema = z.object({
  student_id: z.string().uuid(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

  // Verify student exists
  const student = await queryOne<{ id: string; name: string; status: string }>(
    `select id, name, status from students where id = $1 and deleted_at is null`,
    [d.student_id]
  );
  if (!student)
    return NextResponse.json({ error: "Student not found." }, { status: 404 });

  // Guard: already on permanent leave
  if (student.status === "permanent_leave")
    return NextResponse.json({ error: "This student already has an active permanent leave." }, { status: 409 });

  const client = await pool.connect();
  try {
    await client.query("begin");

    // 1. Create leave record
    const leave = await client.query(
      `insert into student_leaves (student_id, issue_date, reason, notes, proof_urls, issued_by)
       values ($1,$2,$3,$4,$5,$6)
       returning id`,
      [d.student_id, d.issue_date, d.reason ?? null, d.notes ?? null, d.proof_urls, session!.userId]
    );

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
      [d.student_id, student.status]
    );

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
