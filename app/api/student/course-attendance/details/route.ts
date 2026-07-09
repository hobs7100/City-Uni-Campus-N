import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const studentId = session!.userId;
  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const courseId   = request.nextUrl.searchParams.get("course_id");

  if (!semesterId || !courseId)
    return NextResponse.json({ error: "semester_id and course_id required." }, { status: 400 });

  const student = await queryOne<{ class_id: string }>(
    `select class_id from students where id = $1 and deleted_at is null`,
    [studentId]
  );
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  /* find which days-of-week this course is scheduled in the timetable for this semester */
  const records = await query<{
    attendance_date: string; status: string;
    reason: string | null; call_remarks: string | null;
  }>(
    `with tt as (
       select id as timetable_id
       from timetables
       where class_id = $4 and semester_id = $1
       limit 1
     ),
     course_days as (
       select distinct td.day_name
       from tt
       join timetable_cells tc on tc.timetable_id = tt.timetable_id
                               and tc.allocation_id is not null
       join allocations al      on al.id = tc.allocation_id and al.course_id = $2
       join timetable_days td  on td.id = tc.day_id
     )
     select sar.attendance_date::text, sar.status, sar.reason, sar.call_remarks
     from student_attendance_records sar
     where sar.student_id = $3
       and sar.semester_id = $1
       and trim(to_char(sar.attendance_date, 'Day')) in (select day_name from course_days)
     order by sar.attendance_date desc`,
    [semesterId, courseId, studentId, student.class_id]
  );

  return NextResponse.json({ records });
}
