import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { getAttendanceFlag, getAttendancePolicy, type StudentLeaveType } from "@/lib/attendance-policy";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const classId = request.nextUrl.searchParams.get("class_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!semesterId) {
    return NextResponse.json({ error: "semester_id is required." }, { status: 400 });
  }

  const conditions: string[] = ["st.deleted_at is null", "st.class_id = c.id"];
  const values: unknown[] = [semesterId];
  let i = 2;
  conditions.push(`c.id = (select class_id from semesters where id = $1)`);
  if (departmentId) { conditions.push(`st.department_id = $${i++}`); values.push(departmentId); }
  if (classId) { conditions.push(`st.class_id = $${i++}`); values.push(classId); }

  const dateConditions: string[] = ["r.semester_id = $1"];
  if (from) { dateConditions.push(`r.attendance_date >= $${i++}`); values.push(from); }
  if (to) { dateConditions.push(`r.attendance_date <= $${i++}`); values.push(to); }

  const rows = await query<Record<string, unknown>>(
    `select st.id as student_id, st.name, st.roll_no, st.contact, st.status as student_status,
            count(*) filter (where r.status = 'present') as presents,
            count(*) filter (where r.status = 'absent') as absents,
             count(*) filter (where r.status = 'leave') as leaves,
             case when exists (
               select 1 from student_leaves sl
               where sl.student_id = st.id
                 and sl.revoked_at is null
                 and sl.leave_type = 'partial'
             ) then 'partial'::varchar else 'permanent'::varchar end as leave_type
     from students st
     join classes c on c.id = st.class_id
     left join student_attendance_records r on r.student_id = st.id and ${dateConditions.join(" and ")}
     where ${conditions.join(" and ")}
      group by st.id, st.name, st.roll_no, st.contact, st.status
     order by (st.roll_no is null), st.roll_no, st.name`,
    values
  );

  const students = rows.map((r) => {
    const presents = Number(r.presents ?? 0);
    const absents = Number(r.absents ?? 0);
    const leaves = Number(r.leaves ?? 0);
    const denom = presents + absents;
    const percentage = denom > 0 ? Math.round((presents / denom) * 10000) / 100 : null;
    const leaveType = r.leave_type as StudentLeaveType;
    const policy = getAttendancePolicy(leaveType);
    const flag = percentage === null ? "ok" : getAttendanceFlag(percentage, leaveType);
    return {
      student_id: r.student_id,
      name: r.name,
      roll_no: r.roll_no,
      contact: r.contact,
      student_status: r.student_status,
      presents,
      absents,
      leaves,
      percentage,
      flag,
      leave_type: leaveType,
      policy_threshold: policy.struckOffBelow,
    };
  });

  return NextResponse.json({ students });
}
