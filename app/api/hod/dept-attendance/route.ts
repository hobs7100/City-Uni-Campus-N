import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/hod/dept-attendance
// Returns class-wise attendance aggregates (coordinator-marked only)
// scoped to the requesting HoD's own department(s).
export async function GET() {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const depts = await query<{ id: string; name: string }>(
    `SELECT id, name FROM departments WHERE hod_id = $1 ORDER BY name`,
    [session!.userId]
  );
  const deptIds = depts.map((d) => d.id);
  if (deptIds.length === 0) return NextResponse.json({ rows: [], departments: [] });

  const rows = await query<{
    department_id:   string;
    department_name: string;
    class_id:        string;
    class_name:      string;
    session:         string;
    semester_id:     string;
    semester_number: number;
    term_type:       string;
    active_students: string;
    presents:        string;
    absents:         string;
    leaves:          string;
    marked_days:     string;
  }>(
    `SELECT
       d.id          AS department_id,
       d.name        AS department_name,
       cl.id         AS class_id,
       cl.class_name,
       cl.session,
       sem.id        AS semester_id,
       sem.semester_number,
       sem.term_type,
       COUNT(DISTINCT s.id)
         FILTER (WHERE s.status = 'active' AND s.deleted_at IS NULL)             AS active_students,
       COUNT(*) FILTER (WHERE sar.status = 'present' AND u.role = 'coordinator') AS presents,
       COUNT(*) FILTER (WHERE sar.status = 'absent'  AND u.role = 'coordinator') AS absents,
       COUNT(*) FILTER (WHERE sar.status = 'leave'   AND u.role = 'coordinator') AS leaves,
       COUNT(DISTINCT sar.attendance_date)
         FILTER (WHERE u.role = 'coordinator')                                   AS marked_days
     FROM departments d
     JOIN classes cl  ON cl.department_id  = d.id
     JOIN semesters sem ON sem.class_id    = cl.id AND sem.status = 'active'
     LEFT JOIN students s
       ON s.class_id = cl.id AND s.deleted_at IS NULL
     LEFT JOIN student_attendance_records sar
       ON sar.student_id = s.id AND sar.semester_id = sem.id
     LEFT JOIN users u ON u.id = sar.marked_by
     WHERE d.id = ANY($1::uuid[])
     GROUP BY d.id, d.name, cl.id, cl.class_name, cl.session,
              sem.id, sem.semester_number, sem.term_type
     ORDER BY d.name, cl.class_name, cl.session`,
    [deptIds]
  );

  return NextResponse.json({ rows, departments: depts });
}
