import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const teacherId = request.nextUrl.searchParams.get("teacher_id");
  const status = request.nextUrl.searchParams.get("status");
  const billType = request.nextUrl.searchParams.get("bill_type");
  const classId = request.nextUrl.searchParams.get("class_id");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`b.department_id = $${i++}`); values.push(departmentId); }
  if (teacherId) { conditions.push(`b.teacher_id = $${i++}`); values.push(teacherId); }
  if (status) { conditions.push(`b.status = $${i++}`); values.push(status); }
  if (billType) { conditions.push(`b.bill_type = $${i++}`); values.push(billType); }
  if (classId) {
    conditions.push(`exists (select 1 from bill_items bi2 where bi2.bill_id = b.id and bi2.class_id = $${i++})`);
    values.push(classId);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const bills = await query(
    `select b.id, b.bill_number, b.bill_type, b.teacher_id, b.department_id,
            b.billing_month, b.period_from, b.period_to, b.total_amount, b.status,
            b.paid_at, b.payment_mode, b.cheque_number, b.created_at,
            te.name as teacher_name, te.account_number, te.account_title, te.bank_name,
            d.name as department_name,
            coalesce(
              (select json_agg(json_build_object(
                  'id', bi.id,
                  'course_code', c.code,
                  'course_title', c.title,
                  'class_name', cl.class_name,
                  'session', cl.session,
                  'semester_number', s.semester_number,
                  'allocation_type', bi.allocation_type,
                  'total_lectures', bi.total_lectures,
                  'rate', bi.rate,
                  'amount', bi.amount,
                  'attendance', coalesce(
                    (select json_agg(json_build_object(
                        'attendance_date', ar.attendance_date,
                        'lecture_count', ar.lecture_count,
                        'late_minutes', ar.late_minutes,
                        'status', ar.status
                      ) order by ar.attendance_date, ar.start_time)
                     from attendance_records ar where ar.bill_item_id = bi.id),
                    '[]'
                  )
                ))
               from bill_items bi
               left join courses c on c.id = bi.course_id
               left join classes cl on cl.id = bi.class_id
               left join semesters s on s.id = bi.semester_id
               where bi.bill_id = b.id),
              '[]'
            ) as items
     from bills b
     join teachers te on te.id = b.teacher_id
     join departments d on d.id = b.department_id
     ${where}
     order by b.created_at desc`,
    values
  );

  return NextResponse.json({ bills });
}
