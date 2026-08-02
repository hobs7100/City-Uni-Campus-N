import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const courseId = request.nextUrl.searchParams.get("course_id");
  const dateFrom = request.nextUrl.searchParams.get("date_from");
  const dateTo   = request.nextUrl.searchParams.get("date_to");

  if (!courseId) {
    return NextResponse.json({ error: "course_id is required." }, { status: 400 });
  }

  const params: unknown[] = [courseId];
  let pIdx = 2;
  let teacherDateFilter = "";
  let coordDateFilter   = "";

  if (dateFrom) {
    teacherDateFilter += ` AND ar.attendance_date >= $${pIdx}`;
    coordDateFilter   += ` AND sar.attendance_date >= $${pIdx}`;
    params.push(dateFrom);
    pIdx++;
  }
  if (dateTo) {
    teacherDateFilter += ` AND ar.attendance_date <= $${pIdx}`;
    coordDateFilter   += ` AND sar.attendance_date <= $${pIdx}`;
    params.push(dateTo);
  }

  const rows = await query(
    `SELECT
       c.title        AS course_title,
       c.code         AS course_code,
       c.credit_hours,
       cl.id          AS class_id,
       cl.class_name,
       cl.session,
       s.semester_number,
       COALESCE((
         SELECT COUNT(DISTINCT ar.attendance_date)
         FROM   allocations al2
         JOIN   attendance_records ar ON ar.allocation_id = al2.id
         WHERE  al2.course_id = $1
         AND    EXISTS (
           SELECT 1 FROM allocation_semesters als2
           WHERE  als2.allocation_id = al2.id AND als2.semester_id = s.id
         )
         ${teacherDateFilter}
       ), 0) AS teacher_count,
       COALESCE((
         SELECT COUNT(DISTINCT sar.attendance_date)
         FROM   student_attendance_records sar
         JOIN   students st ON st.id = sar.student_id
         WHERE  st.class_id = cl.id
         ${coordDateFilter}
       ), 0) AS coord_count
     FROM   allocations al
     JOIN   courses c                ON c.id  = al.course_id
     JOIN   allocation_semesters als ON als.allocation_id = al.id
     JOIN   semesters s              ON s.id  = als.semester_id
     JOIN   classes cl               ON cl.id = s.class_id
     WHERE  al.course_id = $1
     GROUP  BY c.title, c.code, c.credit_hours,
               cl.id, cl.class_name, cl.session, s.semester_number
     ORDER  BY cl.class_name, cl.session, s.semester_number`,
    params
  );

  return NextResponse.json({ groups: rows });
}
