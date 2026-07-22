import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/admin/dept-attendance
// Returns class-wise attendance aggregates (coordinator-marked only)
// for all classes that have an active semester.
// Optional: ?department_id=<uuid>  to filter to one department.
export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const sp     = request.nextUrl.searchParams;
  const deptId = sp.get("department_id");

  const params: unknown[] = [];
  const deptWhere = deptId ? `AND d.id = $${(params.push(deptId), 1)}` : "";

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
         FILTER (WHERE s.status = 'active' AND s.deleted_at IS NULL)        AS active_students,
       COUNT(*) FILTER (WHERE sar.status = 'present' AND u.role = 'coordinator') AS presents,
       COUNT(*) FILTER (WHERE sar.status = 'absent'  AND u.role = 'coordinator') AS absents,
       COUNT(*) FILTER (WHERE sar.status = 'leave'   AND u.role = 'coordinator') AS leaves,
       COUNT(DISTINCT sar.attendance_date)
         FILTER (WHERE u.role = 'coordinator')                               AS marked_days
     FROM departments d
     JOIN classes cl  ON cl.department_id  = d.id
     JOIN semesters sem ON sem.class_id    = cl.id AND sem.status = 'active'
     LEFT JOIN students s
       ON s.class_id = cl.id AND s.deleted_at IS NULL
     LEFT JOIN student_attendance_records sar
       ON sar.student_id = s.id AND sar.semester_id = sem.id
     LEFT JOIN users u ON u.id = sar.marked_by
     WHERE 1=1 ${deptWhere}
     GROUP BY d.id, d.name, cl.id, cl.class_name, cl.session,
              sem.id, sem.semester_number, sem.term_type
     ORDER BY d.name, cl.class_name, cl.session`,
    params
  );

  const departments = await query<{ id: string; name: string }>(
    `SELECT id, name FROM departments ORDER BY name`,
    []
  );

  return NextResponse.json({ rows, departments });
}
