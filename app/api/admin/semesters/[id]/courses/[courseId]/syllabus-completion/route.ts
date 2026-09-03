import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; courseId: string }> }
) {
  const { response, session } = await requireRole("admin", "coordinator");
  if (response) return response;

  const { id, courseId } = await params;
  const semesterCourse = await queryOne<{
    semester_id: string;
    course_id: string;
    semester_status: string;
    syllabus_completed_at: string | null;
  }>(
    `select sc.semester_id, sc.course_id, s.status as semester_status, sc.syllabus_completed_at
     from semester_courses sc
     join semesters s on s.id = sc.semester_id
     where sc.semester_id = $1 and sc.course_id = $2`,
    [id, courseId]
  );

  if (!semesterCourse) {
    return NextResponse.json(
      { error: "This course is not part of the selected semester." },
      { status: 404 }
    );
  }
  if (semesterCourse.semester_status === "closed") {
    return NextResponse.json(
      { error: "A course in a closed semester cannot be marked complete." },
      { status: 409 }
    );
  }
  if (semesterCourse.syllabus_completed_at) {
    return NextResponse.json({
      success: true,
      syllabus_completed_at: semesterCourse.syllabus_completed_at,
      already_complete: true,
    });
  }

  const activeAllocation = await queryOne(
    `select 1
     from allocation_semesters als
     join allocations a on a.id = als.allocation_id
     where als.semester_id = $1
       and als.course_id = $2
       and a.status = 'active'
     limit 1`,
    [id, courseId]
  );
  if (!activeAllocation) {
    return NextResponse.json(
      { error: "Assign an active teacher to this course before marking its syllabus complete." },
      { status: 409 }
    );
  }

  const completed = await queryOne<{ syllabus_completed_at: string }>(
    `update semester_courses
     set syllabus_completed_at = now(), syllabus_completed_by = $3
     where semester_id = $1
       and course_id = $2
       and syllabus_completed_at is null
     returning syllabus_completed_at`,
    [id, courseId, session!.userId]
  );

  return NextResponse.json({
    success: true,
    syllabus_completed_at: completed?.syllabus_completed_at ?? semesterCourse.syllabus_completed_at,
  });
}