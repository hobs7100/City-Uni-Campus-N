import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod");
  if (response) return response;

  const date =
    request.nextUrl.searchParams.get("date") ||
    new Date().toISOString().slice(0, 10);

  // ── 1. Department-wise student attendance (coordinator-marked only) ─────────
  const deptRaw = await query<{
    department_id: string;
    department_name: string;
    total_students: string;
    presents: string;
    absents: string;
  }>(
    `SELECT
       d.id   AS department_id,
       d.name AS department_name,
       COUNT(DISTINCT s.id)::text                                    AS total_students,
       COUNT(sar.student_id) FILTER (WHERE sar.status = 'present')::text AS presents,
       COUNT(sar.student_id) FILTER (WHERE sar.status = 'absent')::text  AS absents
     FROM departments d
     JOIN classes cl ON cl.department_id = d.id
     -- Only classes with a currently running semester (active / mid_term / final_term)
     JOIN semesters sem
       ON sem.class_id = cl.id
      AND sem.status  != 'closed'
     JOIN students s
       ON s.class_id   = cl.id
      AND s.status     = 'active'
      AND s.deleted_at IS NULL
     LEFT JOIN (
       SELECT sar2.student_id, sar2.status
       FROM   student_attendance_records sar2
       JOIN   users u ON u.id = sar2.marked_by AND u.role = 'coordinator'
       WHERE  sar2.attendance_date = $1
     ) sar ON sar.student_id = s.id
     GROUP  BY d.id, d.name
     HAVING COUNT(DISTINCT s.id) > 0
     ORDER  BY d.name`,
    [date]
  );

  const departments = deptRaw.map((r) => {
    const total = parseInt(r.total_students, 10);
    const p     = parseInt(r.presents, 10);
    const a     = parseInt(r.absents, 10);
    return {
      department_id:   r.department_id,
      department_name: r.department_name,
      total_students:  total,
      presents:        p,
      absents:         a,
      percentage:      total > 0 ? parseFloat(((p / total) * 100).toFixed(1)) : null,
    };
  });

  // ── 2. Absent teachers (one row per teacher regardless of courses) ────────
  const absentTeachers = await query<{
    teacher_name: string;
    department_name: string;
    teacher_type: string;
    remarks: string | null;
  }>(
    `SELECT
       t.name  AS teacher_name,
       t.type  AS teacher_type,
       STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) AS department_name,
       STRING_AGG(DISTINCT ar.remarks, '; ')
         FILTER (WHERE ar.remarks IS NOT NULL AND ar.remarks <> '') AS remarks
     FROM attendance_records ar
     JOIN allocations al           ON al.id  = ar.allocation_id
     JOIN teachers    t            ON t.id   = al.teacher_id AND t.deleted_at IS NULL
     JOIN allocation_semesters als ON als.allocation_id = al.id
     JOIN semesters sem            ON sem.id = als.semester_id
     JOIN classes   cl             ON cl.id  = sem.class_id
     JOIN departments d            ON d.id   = cl.department_id
     WHERE ar.attendance_date = $1
       AND ar.status          = 'absent'
     GROUP BY t.id, t.name, t.type
     ORDER BY t.name`,
    [date]
  );

  // ── 3. Late teachers ──────────────────────────────────────────────────────
  const lateTeachers = await query<{
    teacher_name: string;
    course_code: string;
    course_title: string;
    department_name: string;
    teacher_type: string;
    late_minutes: string;
  }>(
    `SELECT
       t.name  AS teacher_name,
       c.code  AS course_code,
       c.title AS course_title,
       d.name  AS department_name,
       t.type  AS teacher_type,
       MAX(ar.late_minutes)::text AS late_minutes
     FROM attendance_records ar
     JOIN allocations al          ON al.id  = ar.allocation_id
     JOIN teachers    t           ON t.id   = al.teacher_id AND t.deleted_at IS NULL
     JOIN courses     c           ON c.id   = al.course_id
     JOIN allocation_semesters als ON als.allocation_id = al.id
     JOIN semesters sem           ON sem.id = als.semester_id
     JOIN classes   cl            ON cl.id  = sem.class_id
     JOIN departments d           ON d.id   = cl.department_id
     WHERE ar.attendance_date = $1
       AND ar.late_minutes    > 0
       AND ar.status         != 'absent'
     GROUP BY t.id, t.name, c.id, c.code, c.title, d.id, d.name, t.type
     ORDER BY MAX(ar.late_minutes) DESC, d.name, t.name`,
    [date]
  );

  return NextResponse.json({
    date,
    departments,
    absentTeachers: absentTeachers.map((r) => ({
      ...r,
      late_minutes: undefined,
    })),
    lateTeachers: lateTeachers.map((r) => ({
      ...r,
      late_minutes: parseInt(r.late_minutes, 10),
    })),
  });
}
