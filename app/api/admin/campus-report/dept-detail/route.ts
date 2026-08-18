import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod");
  if (response) return response;

  const date          = request.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const departmentId  = request.nextUrl.searchParams.get("department_id");

  if (!departmentId) {
    return NextResponse.json({ error: "department_id is required." }, { status: 400 });
  }

  // Class-level breakdown for a single department on a given date.
  // Only classes whose semester is strictly 'active' are shown
  // (mid_term, final_term, and closed are excluded per spec).
  const rows = await query<{
    class_name:      string;
    session:         string;
    semester_number: string;
    total_students:  string;
    presents:        string;
    absents:         string;
    leaves:          string;
  }>(
    `SELECT
       cl.class_name,
       cl.session,
       sem.semester_number::text AS semester_number,
       COUNT(DISTINCT s.id)::text                                        AS total_students,
       COUNT(sar.student_id) FILTER (WHERE sar.status = 'present')::text AS presents,
       COUNT(sar.student_id) FILTER (WHERE sar.status = 'absent')::text  AS absents,
       COUNT(sar.student_id) FILTER (WHERE sar.status = 'leave')::text   AS leaves
     FROM classes cl
     JOIN departments d   ON d.id  = cl.department_id AND d.id = $2
     JOIN semesters   sem ON sem.class_id = cl.id AND sem.status = 'active'
     JOIN students    s
       ON s.class_id   = cl.id
      AND s.status     = 'active'
      AND s.deleted_at IS NULL
     LEFT JOIN (
       SELECT sar2.student_id, sar2.status
       FROM   student_attendance_records sar2
       JOIN   users u ON u.id = sar2.marked_by AND u.role = 'coordinator'
       WHERE  sar2.attendance_date = $1
     ) sar ON sar.student_id = s.id
     GROUP  BY cl.id, cl.class_name, cl.session, sem.id, sem.semester_number
     HAVING COUNT(DISTINCT s.id) > 0
     ORDER  BY cl.class_name, sem.semester_number`,
    [date, departmentId]
  );

  const classes = rows.map((r) => {
    const p = parseInt(r.presents, 10);
    const a = parseInt(r.absents, 10);
    const l = parseInt(r.leaves, 10);
    return {
      class_name:      r.class_name,
      session:         r.session,
      semester_number: parseInt(r.semester_number, 10),
      total_students:  parseInt(r.total_students, 10),
      presents:        p,
      absents:         a,
      leaves:          l,
      // percentage = present / (present + absent) * 100  (leaves excluded from denominator)
      percentage: (p + a) > 0 ? parseFloat(((p / (p + a)) * 100).toFixed(1)) : null,
    };
  });

  return NextResponse.json({ date, classes });
}
