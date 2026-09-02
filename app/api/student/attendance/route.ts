import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireActiveStudent } from "@/lib/requireActiveStudent";
import { getAttendanceFlag, getAttendancePolicy, type StudentLeaveType } from "@/lib/attendance-policy";

export async function GET(request: NextRequest) {
  const { session, response } = await requireActiveStudent();
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

  const conditions: string[] = [`student_id = $1`, `semester_id = $2`];
  const values: unknown[] = [session!.userId, (semester as { id: string }).id];
  let i = 3;
  if (from) { conditions.push(`attendance_date >= $${i++}`); values.push(from); }
  if (to) { conditions.push(`attendance_date <= $${i++}`); values.push(to); }

  const records = await query(
    `select attendance_date, status, reason, call_remarks from student_attendance_records
     where ${conditions.join(" and ")}
     order by attendance_date desc`,
    values
  );

  const presents = records.filter((r) => (r as { status: string }).status === "present").length;
  const absents = records.filter((r) => (r as { status: string }).status === "absent").length;
  const leaves = records.filter((r) => (r as { status: string }).status === "leave").length;
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
