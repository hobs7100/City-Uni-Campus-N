import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const teacherId = request.nextUrl.searchParams.get("teacher_id");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!teacherId || !from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { error: "teacher_id and valid from/to dates are required." },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json({ error: "From date cannot be after To date." }, { status: 400 });
  }
  const teacher = await queryOne<{ id: string }>(
    `select id from teachers where id = $1 and type = 'visiting' and deleted_at is null`,
    [teacherId],
  );
  if (!teacher) {
    return NextResponse.json({ error: "Visiting teacher not found." }, { status: 404 });
  }

  const rows = await query<{
    allocation_id: string;
    allocation_type: string;
    rate: string;
    course_id: string;
    course_code: string;
    course_title: string;
    classes: string[];
    total_lectures: string;
    billing_period_month: string | null;
  }>(
    `with attendance_totals as (
       select ar.allocation_id,
              case
                when al.allocation_type = 'fixed'
                  then date_trunc('month', ar.attendance_date)::date
                else null
              end as billing_period_month,
              sum(ar.lecture_count)::text as total_lectures
       from attendance_records ar
       join allocations al on al.id = ar.allocation_id
       where al.teacher_id = $1
         and ar.bill_item_id is null
         and ar.attendance_date between $2 and $3
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
       group by ar.allocation_id,
                case
                  when al.allocation_type = 'fixed'
                    then date_trunc('month', ar.attendance_date)::date
                  else null
                end
       having sum(ar.lecture_count) > 0
     )
     select al.id as allocation_id,
            al.allocation_type,
            al.rate::text,
            c.id as course_id,
            c.code as course_code,
            c.title as course_title,
            coalesce(class_info.classes, array[]::text[]) as classes,
            totals.total_lectures,
            totals.billing_period_month::text
     from allocations al
     join attendance_totals totals on totals.allocation_id = al.id
     join courses c on c.id = al.course_id
     cross join lateral (
       select array_agg(
                distinct cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number
                order by cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number
              ) as classes
       from allocation_semesters als
       join semesters s on s.id = als.semester_id
       join classes cl on cl.id = s.class_id
       where als.allocation_id = al.id
     ) class_info
     where al.teacher_id = $1
     order by c.code, c.title, totals.billing_period_month nulls first`,
    [teacherId, from, to],
  );

  const items = rows.map((row) => {
    const rate = Number(row.rate);
    const lectures = Number(row.total_lectures);
    return {
      ...row,
      amount: row.allocation_type === "fixed" ? rate : rate * lectures,
    };
  });

  return NextResponse.json({ items });
}