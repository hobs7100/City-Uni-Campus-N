import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const teacherId = request.nextUrl.searchParams.get("teacher_id");

  const conditions: string[] = ["te.type = 'visiting'"];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`te.department_id = $${i++}`); values.push(departmentId); }
  if (teacherId) { conditions.push(`te.id = $${i++}`); values.push(teacherId); }

  const rows = await query(
    `with chain_info as (
       select id,
              row_number() over (partition by transfer_group_id order by lecture_seq_offset, id) as transfer_part,
              count(*)     over (partition by transfer_group_id)                                 as transfer_total_parts
       from allocations
       where transfer_group_id is not null
     ), attendance_totals as (
       select ar.allocation_id,
              sum(ar.lecture_count) as total_lectures,
              count(
                distinct case
                  when al.allocation_type = 'fixed'
                    then date_trunc('month', ar.attendance_date)::date
                  else null
                end
              )::int as fixed_month_count
       from attendance_records ar
       join allocations al on al.id = ar.allocation_id
       where ar.bill_item_id is null
         and (
           al.allocation_type <> 'fixed'
           or not exists (
             select 1
             from bill_items existing_item
             where existing_item.allocation_id = al.id
               and existing_item.allocation_type = 'fixed'
               and existing_item.billing_period_month =
                   date_trunc('month', ar.attendance_date)::date
           )
         )
       group by ar.allocation_id
       having sum(ar.lecture_count) > 0
     )
     select al.id as allocation_id, al.allocation_type, al.rate,
            al.transfer_group_id,
            coalesce(ci.transfer_part, 1)::int        as transfer_part,
            coalesce(ci.transfer_total_parts, 1)::int as transfer_total_parts,
            c.id as course_id, c.code as course_code, c.title as course_title,
            te.id as teacher_id, te.name as teacher_name,
            te.department_id,
            sem.semester_id, cl.id as class_id, cl.class_name, cl.session,
            sem.semester_number,
            to_char(sem.close_date, 'YYYY-MM-DD') as semester_closed_date,
            array[cl.class_name || ' (' || cl.session || ') - Sem ' || sem.semester_number] as classes,
             totals.total_lectures,
             totals.fixed_month_count,
             coalesce((
               select json_agg(json_build_object(
                 'attendance_date', ar.attendance_date,
                 'lecture_count', ar.lecture_count,
                 'late_minutes', ar.late_minutes,
                 'status', ar.status
               ) order by ar.attendance_date, ar.start_time)
               from attendance_records ar
               where ar.allocation_id = al.id and ar.bill_item_id is null
             ), '[]'::json) as attendance
     from allocations al
     join attendance_totals totals on totals.allocation_id = al.id
     join teachers te on te.id = al.teacher_id
     join courses c on c.id = al.course_id
     join lateral (
       select s.id as semester_id, s.class_id, s.semester_number, s.close_date
       from allocation_semesters als
       join semesters s on s.id = als.semester_id
       where als.allocation_id = al.id and s.status = 'closed'
       order by s.semester_number
       limit 1
     ) sem on true
     join classes cl on cl.id = sem.class_id
     left join chain_info ci on ci.id = al.id
     where ${conditions.join(" and ")}
     order by cl.class_name, cl.session, sem.semester_number, te.name, c.code, ci.transfer_part`,
    values
  );

  const items = rows.map((r) => {
    const row = r as Record<string, unknown> & {
      allocation_type: string;
      rate: string;
      total_lectures: string;
      fixed_month_count: number;
    };
    const rate = Number(row.rate);
    const lectures = Number(row.total_lectures);
    const amount =
      row.allocation_type === "fixed" ? rate * row.fixed_month_count : rate * lectures;
    return { ...row, amount };
  });

  return NextResponse.json({ items });
}
