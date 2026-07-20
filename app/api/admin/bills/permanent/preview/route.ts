import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const teacherId = request.nextUrl.searchParams.get("teacher_id");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!teacherId || !from || !to) {
    return NextResponse.json({ error: "teacher_id, from and to are required." }, { status: 400 });
  }

  const rows = await query(
    `with chain_info as (
       select id,
              row_number() over (partition by transfer_group_id order by lecture_seq_offset, id) as transfer_part,
              count(*)     over (partition by transfer_group_id)                                 as transfer_total_parts
       from allocations
       where transfer_group_id is not null
     )
     select al.id as allocation_id, al.allocation_type as underlying_type, al.rate as underlying_rate,
            al.transfer_group_id,
            coalesce(ci.transfer_part, 1)::int        as transfer_part,
            coalesce(ci.transfer_total_parts, 1)::int as transfer_total_parts,
            c.id as course_id, c.code as course_code, c.title as course_title,
            array_agg(distinct cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number) as classes,
            coalesce((select sum(ar.lecture_count) from attendance_records ar
                      where ar.allocation_id = al.id and ar.bill_item_id is null
                        and ar.attendance_date between $2 and $3), 0) as total_lectures
     from allocations al
     join courses c on c.id = al.course_id
     join allocation_semesters als on als.allocation_id = al.id
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     left join chain_info ci on ci.id = al.id
     where al.teacher_id = $1
     group by al.id, al.allocation_type, al.rate, al.transfer_group_id,
              ci.transfer_part, ci.transfer_total_parts,
              c.id, c.code, c.title
     having coalesce((select sum(ar.lecture_count) from attendance_records ar
                      where ar.allocation_id = al.id and ar.bill_item_id is null
                        and ar.attendance_date between $2 and $3), 0) > 0
     order by c.code, ci.transfer_part`,
    [teacherId, from, to]
  );

  return NextResponse.json({ items: rows });
}
