import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const sp           = request.nextUrl.searchParams;
  const courseId     = sp.get("course_id");
  const deptId       = sp.get("department_id");
  const dateFrom     = sp.get("date_from");
  const dateTo       = sp.get("date_to");
  const mismatchOnly = sp.get("mismatch_only") === "true";

  const params: unknown[] = [];
  let pIdx = 1;

  const whereClauses: string[] = [];
  if (courseId) {
    whereClauses.push(`al.course_id = $${pIdx++}`);
    params.push(courseId);
  }
  if (deptId) {
    whereClauses.push(`te.department_id = $${pIdx++}`);
    params.push(deptId);
  }

  // Separate alias-aware date filters for each subquery table alias
  let arDateFilter  = "";   // attendance_records        alias: ar
  let scaDateFilter = "";   // student_course_attendance  alias: sca
  if (dateFrom) {
    arDateFilter  += ` AND ar.attendance_date  >= $${pIdx}`;
    scaDateFilter += ` AND sca.attendance_date >= $${pIdx}`;
    pIdx++;
    params.push(dateFrom);
  }
  if (dateTo) {
    arDateFilter  += ` AND ar.attendance_date  <= $${pIdx}`;
    scaDateFilter += ` AND sca.attendance_date <= $${pIdx}`;
    pIdx++;
    params.push(dateTo);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // teacher_count:
  //   Number of distinct teaching sessions the teacher held, evidenced by
  //   them marking student attendance in student_course_attendance.
  //   (marked_by in that table references teachers.id, same as al.teacher_id)
  //
  // coord_count:
  //   Number of sessions the coordinator/admin recorded in attendance_records
  //   for the same allocation.
  const teacherCountExpr = `
    COALESCE((
      SELECT COUNT(*) FROM (
        SELECT DISTINCT sca.attendance_date, sca.start_time, sca.end_time
        FROM   student_course_attendance sca
        WHERE  sca.allocation_id = al.id
          AND  sca.marked_by     = al.teacher_id
          ${scaDateFilter}
      ) _tsub
    ), 0)::int`;

  const coordCountExpr = `
    COALESCE((
      SELECT COUNT(*)
      FROM   attendance_records ar
      WHERE  ar.allocation_id = al.id
        ${arDateFilter}
    ), 0)::int`;

  const havingSQL = mismatchOnly
    ? `HAVING (${teacherCountExpr}) != (${coordCountExpr})`
    : "";

  const rows = await query(
    `SELECT
       c.title          AS course_title,
       c.code           AS course_code,
       c.credit_hours,
       cl.id            AS class_id,
       cl.class_name,
       cl.session,
       s.semester_number,
       te.id            AS teacher_id,
       te.name          AS teacher_name,
       te.type          AS teacher_type,
       (${teacherCountExpr}) AS teacher_count,
       (${coordCountExpr})   AS coord_count
     FROM   allocations al
     JOIN   courses  c               ON c.id  = al.course_id
     JOIN   teachers te              ON te.id = al.teacher_id
     JOIN   allocation_semesters als ON als.allocation_id = al.id
     JOIN   semesters s              ON s.id  = als.semester_id
     JOIN   classes   cl             ON cl.id = s.class_id
     ${whereSQL}
     GROUP  BY c.title, c.code, c.credit_hours,
               cl.id, cl.class_name, cl.session, s.semester_number,
               te.id, te.name, te.type, al.id
     ${havingSQL}
     ORDER  BY cl.class_name, cl.session, s.semester_number`,
    params
  );

  return NextResponse.json({ groups: rows });
}
