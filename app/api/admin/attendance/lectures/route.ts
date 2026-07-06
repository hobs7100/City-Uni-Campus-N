import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

function dayNameFor(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const dateParam = request.nextUrl.searchParams.get("date");
  const departmentId = request.nextUrl.searchParams.get("department_id");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);
  const dayName = dayNameFor(date);

  const values: unknown[] = [dayName];
  let i = 2;
  if (departmentId) {
    i++;
    values.push(departmentId);
  }
  values.push(date);
  const dateParamIndex = i;

  const lectures = await query(
    `select distinct on (al.id, tp.start_time, tp.end_time)
            al.id as allocation_id,
            c.code as course_code, c.title as course_title,
            te.id as teacher_id, te.name as teacher_name, te.type as teacher_type,
            te.department_id as department_id, dept.name as department_name,
            tp.start_time, tp.end_time, td.day_name,
            al.is_combined,
            coalesce(
              (select json_agg(json_build_object('class_name', cl2.class_name, 'session', cl2.session) order by cl2.class_name)
               from classes cl2 where cl2.id in (
                 select distinct tt2.class_id from timetable_cells tc2
                 join timetables tt2 on tt2.id = tc2.timetable_id
                 where tc2.allocation_id = al.id
               )),
              '[]'
            ) as classes,
            ar.id as attendance_id, ar.lecture_count, ar.late_minutes, ar.status, ar.remarks,
            ar.bill_item_id is not null as is_billed
     from timetable_cells tc
     join timetable_days td on td.id = tc.day_id
     join timetable_periods tp on tp.id = tc.period_id
     join allocations al on al.id = tc.allocation_id
     join courses c on c.id = al.course_id
     join teachers te on te.id = al.teacher_id
     join departments dept on dept.id = te.department_id
     left join attendance_records ar on ar.allocation_id = al.id and ar.attendance_date = $${dateParamIndex}
       and ar.start_time = tp.start_time and ar.end_time = tp.end_time
     where td.day_name = $1
       ${departmentId ? `and exists (
         select 1 from timetable_cells tc3
         join timetables tt3 on tt3.id = tc3.timetable_id
         where tc3.allocation_id = tc.allocation_id and tt3.department_id = $2
       )` : ""}
     order by al.id, tp.start_time, tp.end_time`,
    values
  );
  lectures.sort((a, b) => {
    const ra = a as { start_time: string; course_code: string };
    const rb = b as { start_time: string; course_code: string };
    return ra.start_time.localeCompare(rb.start_time) || ra.course_code.localeCompare(rb.course_code);
  });

  return NextResponse.json({ date, day_name: dayName, lectures });
}
