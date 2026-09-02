import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/admin/rollno-slips
// Returns all active students who have an active semester AND whose
// overall coordinator/admin-marked attendance (student_attendance_records)
// is below their Roll Number Slip threshold, together with their override status.
export async function GET() {
  const { session, response } = await requireRole("admin", "hod");
  if (response) return response;
  if (session!.role === "assistant") return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const rows = await query<{
    student_id:       string;
    name:             string;
    father_name:      string | null;
    roll_no:          string | null;
    class_name:       string;
    session:          string;
    department_name:  string;
    semester_id:      string;
    semester_number:  number;
    presents:         string;
    absents:          string;
    override_id:      string | null;
    allowed_at:       string | null;
    notes:            string | null;
    allowed_by_name:  string | null;
    allowed_by_id:    string | null;
    leave_type:       "partial" | null;
    policy_threshold: string;
  }>(
    `SELECT
       s.id            AS student_id,
       s.name,
       s.father_name,
       s.roll_no,
       cl.class_name,
       s.session,
       d.name          AS department_name,
       sem.id          AS semester_id,
       sem.semester_number,
       COUNT(sar.id) FILTER (WHERE sar.status = 'present')::text  AS presents,
       COUNT(sar.id) FILTER (WHERE sar.status = 'absent')::text   AS absents,
       rso.id          AS override_id,
       rso.allowed_at::text,
       rso.notes,
       u.name          AS allowed_by_name,
       u.id            AS allowed_by_id,
       active_leave.leave_type,
       CASE WHEN active_leave.leave_type = 'partial' THEN 40 ELSE 75 END::text
         AS policy_threshold
     FROM   students s
     JOIN   classes cl     ON cl.id  = s.class_id
     JOIN   departments d  ON d.id   = s.department_id
     JOIN   semesters sem  ON sem.class_id = s.class_id AND sem.status = 'active'
     LEFT JOIN student_attendance_records sar
       ON sar.student_id = s.id AND sar.semester_id = sem.id
     LEFT JOIN rollno_slip_overrides rso ON rso.student_id = s.id
     LEFT JOIN users u ON u.id = rso.allowed_by
     LEFT JOIN LATERAL (
       SELECT leave_type
       FROM student_leaves
       WHERE student_id = s.id AND revoked_at IS NULL AND leave_type = 'partial'
       ORDER BY created_at DESC
       LIMIT 1
     ) active_leave ON true
     WHERE  s.deleted_at IS NULL AND s.status = 'active'
     GROUP  BY s.id, s.name, s.father_name, s.roll_no,
               cl.class_name, s.session, d.name,
               sem.id, sem.semester_number,
                rso.id, rso.allowed_at, rso.notes, u.name, u.id,
                active_leave.leave_type
     HAVING
       /* students with NO records count as 0 % — still include them */
       CASE
         WHEN COUNT(sar.id) FILTER (WHERE sar.status IN ('present','absent')) = 0
           THEN true
         ELSE
           (COUNT(sar.id) FILTER (WHERE sar.status = 'present')::float /
            NULLIF(COUNT(sar.id) FILTER (WHERE sar.status IN ('present','absent')), 0)
            ) * 100 < CASE WHEN active_leave.leave_type = 'partial' THEN 40 ELSE 75 END
       END
     ORDER  BY d.name, cl.class_name, s.session, s.name`,
    []
  );

  const students = rows.map((r) => {
    const p   = parseInt(r.presents, 10);
    const a   = parseInt(r.absents,  10);
    const pct = p + a > 0 ? parseFloat(((p / (p + a)) * 100).toFixed(1)) : 0;
    return {
      student_id:      r.student_id,
      name:            r.name,
      father_name:     r.father_name,
      roll_no:         r.roll_no,
      class_name:      r.class_name,
      session:         r.session,
      department_name: r.department_name,
      semester_id:     r.semester_id,
      semester_number: r.semester_number,
      presents:        p,
      absents:         a,
      att_percentage:  pct,
      leave_type:      r.leave_type,
      policy_threshold: Number(r.policy_threshold),
      override:        r.override_id
        ? {
            id:           r.override_id,
            allowed_at:   r.allowed_at,
            notes:        r.notes,
            allowed_by:   r.allowed_by_name,
            allowed_by_id: r.allowed_by_id,
          }
        : null,
    };
  });

  return NextResponse.json({ students });
}
