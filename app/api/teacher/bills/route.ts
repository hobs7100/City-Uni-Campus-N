import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  // Fetch bills for this teacher, including per-bill course items
  const bills = await query(
    `select
       b.id,
       b.bill_number,
       b.bill_type,
       b.billing_month,
       to_char(b.period_from, 'YYYY-MM-DD') as period_from,
       to_char(b.period_to,   'YYYY-MM-DD') as period_to,
       b.total_amount,
       b.status,
       b.payment_mode,
       b.cheque_number,
       b.created_at,
       b.paid_at,
       d.name as department_name,
       coalesce(
         (select json_agg(json_build_object(
             'id',              bi.id,
             'course_code',     c.code,
             'course_title',    c.title,
             'class_name',      cl.class_name,
             'session',         cl.session,
             'semester_number', s.semester_number,
             'allocation_type', bi.allocation_type,
             'total_lectures',  bi.total_lectures,
             'rate',            bi.rate,
             'amount',          bi.amount
           ) order by cl.class_name)
            from bill_items bi
            left join courses   c  on c.id  = bi.course_id
            left join classes   cl on cl.id = bi.class_id
            left join semesters s  on s.id  = bi.semester_id
           where bi.bill_id = b.id),
         '[]'
       ) as items
     from bills b
     join departments d on d.id = b.department_id
    where b.teacher_id = $1
    order by b.created_at desc`,
    [session!.userId]
  );

  return NextResponse.json({ bills });
}
