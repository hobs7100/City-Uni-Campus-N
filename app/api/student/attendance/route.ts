import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { getAttendanceFlag, getAttendancePolicy, type StudentLeaveType } from "@/lib/attendance-policy";
import { getStudentAttendanceHistory } from "@/lib/student-attendance-history";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const student = await queryOne<{ class_id: string; active_leave_type: StudentLeaveType }>(
    `select st.class_id, active_leave.leave_type as active_leave_type
     from students st
     left join lateral (
       select leave_type from student_leaves
       where student_id = st.id and revoked_at is null
       order by created_at desc
       limit 1
     ) active_leave on true
     where st.id = $1 and st.deleted_at is null`,
    [session!.userId],
  );
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  const leaveType = student.active_leave_type ?? null;
  const policy = getAttendancePolicy(leaveType);

  const semester = await queryOne(`select id, semester_number, term_type from semesters where class_id = $1 and status = 'active'`, [student.class_id]);
  if (!semester) {
    return NextResponse.json({ semester: null, summary: null, records: [], leave_type: leaveType, policy });
  }

  const records = await getStudentAttendanceHistory(
    session!.userId,
    (semester as { id: string }).id,
    leaveType,
    { from, to },
  );

  const presents = records.filter((r) => r.attendance_status === "present").length;
  const absents = records.filter((r) => r.attendance_status === "absent").length;
  const leaves = records.filter((r) => r.attendance_status === "leave").length;
  const percentage = presents + absents > 0 ? (presents / (presents + absents)) * 100 : 0;
  const flag = getAttendanceFlag(percentage, leaveType);

  return NextResponse.json({
    semester,
    summary: { presents, absents, leaves, percentage: Number(percentage.toFixed(2)), flag },
    records,
    leave_type: leaveType,
    policy,
  });
}
