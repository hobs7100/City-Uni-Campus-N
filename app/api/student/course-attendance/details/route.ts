import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireActiveStudent } from "@/lib/requireActiveStudent";

export async function GET(request: NextRequest) {
  const { session, response } = await requireActiveStudent();
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

  /* Read the teacher-marked records directly so the detail list uses the same
     source and identity as the course summary on every portal. */
  const records = await query<{
    attendance_date: string; status: string;
    reason: string | null; call_remarks: string | null;
  }>(
    `select sca.attendance_date::text, sca.status, sca.reason, sca.call_remarks
     from student_course_attendance sca
     join allocations al on al.id = sca.allocation_id
     join allocation_semesters als
       on als.allocation_id = al.id and als.semester_id = $1
     where sca.student_id = $3
       and al.course_id = $2
     order by sca.attendance_date desc, sca.start_time desc nulls last`,
    [semesterId, courseId, studentId]
  );

  return NextResponse.json({ records });
}
