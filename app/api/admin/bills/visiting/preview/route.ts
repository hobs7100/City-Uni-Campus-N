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
            array_agg(distinct cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number) as classes,
             totals.total_lectures,
             totals.fixed_month_count
     from allocations al
     join attendance_totals totals on totals.allocation_id = al.id
     join teachers te on te.id = al.teacher_id
     join courses c on c.id = al.course_id
     join allocation_semesters als on als.allocation_id = al.id
     join semesters s on s.id = als.semester_id and s.status = 'closed'
     join classes cl on cl.id = s.class_id
     left join chain_info ci on ci.id = al.id
     where ${conditions.join(" and ")}
     group by al.id, al.allocation_type, al.rate, al.transfer_group_id,
              ci.transfer_part, ci.transfer_total_parts,
               c.id, c.code, c.title, te.id, te.name, te.department_id,
               totals.total_lectures, totals.fixed_month_count
     order by te.name, c.code, ci.transfer_part`,
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
