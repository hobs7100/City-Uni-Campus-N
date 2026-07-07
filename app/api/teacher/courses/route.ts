import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const rows = await query<{
    allocation_id: string;
    course_id: string;
    course_code: string;
    course_title: string;
    credit_hours: string;
    allocation_type: string;
    rate: string;
    is_combined: boolean;
    semester_id: string;
    semester_number: number;
    term_type: string;
    semester_status: string;
    class_id: string;
    class_name: string;
    session: string;
    outline_url: string | null;
  }>(
    `select a.id as allocation_id, c.id as course_id, c.code as course_code, c.title as course_title,
            c.credit_hours, a.allocation_type, a.rate, a.is_combined,
            s.id as semester_id, s.semester_number, s.term_type, s.status as semester_status,
            cl.id as class_id, cl.class_name, cl.session,
            sc.course_outline_url as outline_url
     from allocations a
     join courses c on c.id = a.course_id
     join allocation_semesters als on als.allocation_id = a.id
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     left join semester_courses sc on sc.semester_id = als.semester_id and sc.course_id = a.course_id
     where a.teacher_id = $1
     order by cl.class_name, s.semester_number`,
    [session!.userId]
  );

  const allocationIds = Array.from(new Set(rows.map((r) => r.allocation_id)));
  let paymentByAllocation = new Map<string, { status: "paid" | "pending" | "n/a"; delivered: number }>();
  if (allocationIds.length > 0) {
    const paymentRows = await query<{
      allocation_id: string;
      total_lectures: string;
      unbilled_lectures: string;
      unpaid_bills: string;
    }>(
      `select allocation_id,
              count(*) as total_lectures,
              count(*) filter (where bill_item_id is null) as unbilled_lectures,
              count(*) filter (where bill_item_id is not null and bi_status = 'unpaid') as unpaid_bills
       from (
         select ar.allocation_id, ar.bill_item_id, b.status as bi_status
         from attendance_records ar
         left join bill_items bi on bi.id = ar.bill_item_id
         left join bills b on b.id = bi.bill_id
         where ar.allocation_id = any($1::uuid[])
       ) x
       group by allocation_id`,
      [allocationIds]
    );
    paymentByAllocation = new Map(
      paymentRows.map((r) => {
        const total = Number(r.total_lectures);
        const unbilled = Number(r.unbilled_lectures);
        const unpaidBills = Number(r.unpaid_bills);
        let status: "paid" | "pending" | "n/a" = "n/a";
        if (total > 0) {
          status = unbilled > 0 || unpaidBills > 0 ? "pending" : "paid";
        }
        return [r.allocation_id, { status, delivered: total }];
      })
    );
  }

  const active = rows
    .filter((r) => r.semester_status === "active")
    .map((r) => ({
      ...r,
      delivered_lectures: paymentByAllocation.get(r.allocation_id)?.delivered ?? 0,
    }));
  const inactive = rows
    .filter((r) => r.semester_status === "closed")
    .map((r) => ({
      ...r,
      payment_status: paymentByAllocation.get(r.allocation_id)?.status ?? "n/a",
      delivered_lectures: paymentByAllocation.get(r.allocation_id)?.delivered ?? 0,
    }));

  return NextResponse.json({ active, inactive });
}
