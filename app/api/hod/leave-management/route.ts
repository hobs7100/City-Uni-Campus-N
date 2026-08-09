/**
 * GET /api/hod/leave-management
 * Returns all permanent-leave records for students in the HoD's departments.
 * Same shape as the admin leave-management endpoint, scoped to the HoD.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const departments = await query<{ id: string }>(
    `select id from departments where hod_id = $1`,
    [session!.userId]
  );
  const deptIds = departments.map((d) => d.id);
  if (deptIds.length === 0) return NextResponse.json({ leaves: [] });

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
     where d.id = any($1::uuid[])
     order by sl.created_at desc`,
    [deptIds]
  );

  return NextResponse.json({ leaves });
}
