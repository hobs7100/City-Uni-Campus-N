import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import {
  getStudentAttendanceHistory,
} from "@/lib/student-attendance-history";
import type { StudentLeaveType } from "@/lib/attendance-policy";

interface StudentAccessRow {
  id: string;
  class_id: string;
  department_id: string;
  active_leave_type: StudentLeaveType;
}

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole(
    "admin",
    "coordinator",
    "hod",
    "student",
  );
  if (response) return response;

  const requestedStudentId = request.nextUrl.searchParams.get("student_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const studentId =
    session!.role === "student" ? session!.userId : requestedStudentId;

  if (!studentId || !semesterId) {
    return NextResponse.json(
      { error: "student_id and semester_id are required." },
      { status: 400 },
    );
  }

  const student = await queryOne<StudentAccessRow>(
    `select st.id, st.class_id, st.department_id,
            active_leave.leave_type as active_leave_type
     from students st
     left join lateral (
       select leave_type
       from student_leaves
       where student_id = st.id and revoked_at is null
       order by created_at desc
       limit 1
     ) active_leave on true
     where st.id = $1 and st.deleted_at is null`,
    [studentId],
  );
  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  if (session!.role === "hod") {
    const department = await queryOne<{ id: string }>(
      `select id from departments where id = $1 and hod_id = $2`,
      [student.department_id, session!.userId],
    );
    if (!department) {
      return NextResponse.json({ error: "Student not found." }, { status: 403 });
    }
  }

  const semester = await queryOne<{ id: string }>(
    `select id from semesters where id = $1 and class_id = $2`,
    [semesterId, student.class_id],
  );
  if (!semester) {
    return NextResponse.json({ error: "Semester not found." }, { status: 404 });
  }

  const records = await getStudentAttendanceHistory(
    student.id,
    semester.id,
    student.active_leave_type ?? null,
    { from, to },
  );

  return NextResponse.json({ records });
}