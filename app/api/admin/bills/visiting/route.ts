import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  allocation_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  const { response, session } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }

  const client = await getClient();
  const createdBills: unknown[] = [];
  try {
    await client.query("begin");

    for (const allocationId of parsed.data.allocation_ids) {
      const allocRes = await client.query(
        `select al.id, al.allocation_type, al.rate, al.course_id, al.teacher_id, te.department_id, te.type
         from allocations al join teachers te on te.id = al.teacher_id
         where al.id = $1`,
        [allocationId]
      );
      const alloc = allocRes.rows[0];
      if (!alloc) throw new Error(`Allocation ${allocationId} not found.`);
      if (alloc.type !== "visiting") throw new Error("Only visiting-faculty allocations can be billed here.");

      const closedSemRes = await client.query(
        `select s.id as semester_id, s.class_id, s.semester_number
         from allocation_semesters als join semesters s on s.id = als.semester_id
         where als.allocation_id = $1 and s.status = 'closed'
         order by s.semester_number limit 1`,
        [allocationId]
      );
      if (closedSemRes.rows.length === 0) {
        throw new Error("This allocation has no closed semester and cannot be billed yet.");
      }
      const semester = closedSemRes.rows[0];

      const attendanceRes = await client.query(
        `select coalesce(sum(lecture_count), 0) as total_lectures, count(*) as cnt
         from attendance_records where allocation_id = $1 and bill_item_id is null`,
        [allocationId]
      );
      const totalLectures = Number(attendanceRes.rows[0].total_lectures);
      if (Number(attendanceRes.rows[0].cnt) === 0 || totalLectures <= 0) {
        throw new Error("No unbilled attendance found for this allocation.");
      }

      const rate = Number(alloc.rate);
      const amount = alloc.allocation_type === "fixed" ? rate : rate * totalLectures;

      const billNumRes = await client.query(
        `select 'BILL-' || lpad(nextval('bill_number_seq')::text, 6, '0') as bill_number`
      );
      const billNumber = billNumRes.rows[0].bill_number;

      const billRes = await client.query(
        `insert into bills (bill_number, bill_type, teacher_id, department_id, billing_month, period_from, period_to, total_amount, status, generated_by)
         values ($1, 'visiting', $2, $3, $4, current_date, current_date, $5, 'unpaid', $6)
         returning *`,
        [billNumber, alloc.teacher_id, alloc.department_id, new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), amount, session?.userId ?? null]
      );
      const bill = billRes.rows[0];

      const itemRes = await client.query(
        `insert into bill_items (bill_id, allocation_id, course_id, class_id, semester_id, allocation_type, total_lectures, rate, amount)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *`,
        [bill.id, allocationId, alloc.course_id, semester.class_id, semester.semester_id, alloc.allocation_type, totalLectures, rate, amount]
      );
      const item = itemRes.rows[0];

      await client.query(
        `update attendance_records set bill_item_id = $1 where allocation_id = $2 and bill_item_id is null`,
        [item.id, allocationId]
      );

      const detailsRes = await client.query(
        `select c.code as course_code, c.title as course_title,
                cl.class_name, cl.session,
                te.name as teacher_name
         from courses c, classes cl, teachers te
         where c.id = $1 and cl.id = $2 and te.id = $3`,
        [alloc.course_id, semester.class_id, alloc.teacher_id]
      );
      const details = detailsRes.rows[0];

      const attendanceRowsRes = await client.query(
        `select attendance_date, lecture_count, late_minutes, status
         from attendance_records where bill_item_id = $1 order by attendance_date, start_time`,
        [item.id]
      );

      createdBills.push({
        ...bill,
        items: [
          {
            ...item,
            course_code: details.course_code,
            course_title: details.course_title,
            class_name: details.class_name,
            session: details.session,
            semester_number: semester.semester_number,
            teacher_name: details.teacher_name,
            attendance: attendanceRowsRes.rows,
          },
        ],
      });
    }

    await client.query("commit");
    return NextResponse.json({ bills: createdBills }, { status: 201 });
  } catch (err) {
    await client.query("rollback");
    const message = err instanceof Error ? err.message : "Failed to generate bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
