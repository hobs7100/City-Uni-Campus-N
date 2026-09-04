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
  if (from.slice(0, 7) !== to.slice(0, 7)) {
    return NextResponse.json(
      { error: "Custom visiting bills must stay within one calendar month." },
      { status: 400 },
    );
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
  }>(
    `select al.id as allocation_id,
            al.allocation_type,
            al.rate::text,
            c.id as course_id,
            c.code as course_code,
            c.title as course_title,
            array_agg(distinct cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number) as classes,
            (
              select coalesce(sum(ar.lecture_count), 0)::text
              from attendance_records ar
              where ar.allocation_id = al.id
                and ar.bill_item_id is null
                and ar.attendance_date between $2 and $3
            ) as total_lectures
     from allocations al
     join courses c on c.id = al.course_id
     join allocation_semesters als on als.allocation_id = al.id
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     where al.teacher_id = $1
       and (
         al.allocation_type <> 'fixed'
         or not exists (
           select 1
           from bill_items existing_item
           where existing_item.allocation_id = al.id
             and existing_item.allocation_type = 'fixed'
             and existing_item.billing_period_month = date_trunc('month', $2::date)::date
         )
       )
     group by al.id, al.allocation_type, al.rate, c.id, c.code, c.title
     having (
       select coalesce(sum(ar.lecture_count), 0)
       from attendance_records ar
       where ar.allocation_id = al.id
         and ar.bill_item_id is null
         and ar.attendance_date between $2 and $3
     ) > 0
     order by c.code, c.title`,
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