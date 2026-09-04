import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const itemSchema = z.object({
  allocation_id: z.string().uuid(),
  allocation_type: z.enum(["workload", "extra", "fixed"]),
  rate: z.coerce.number().min(0),
});

const schema = z.object({
  teacher_id: z.string().uuid(),
  period_from: z.string().min(1),
  period_to: z.string().min(1),
  billing_month: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(request: NextRequest) {
  const { response, session } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const client = await getClient();
  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [d.teacher_id]);

    const teacherRes = await client.query(
      `select id, department_id, type from teachers where id = $1`,
      [d.teacher_id]
    );
    const teacher = teacherRes.rows[0];
    if (!teacher) throw new Error("Teacher not found.");
    if (teacher.type !== "permanent") throw new Error("Only permanent-faculty teachers can be billed here.");

    const createdItems: Array<{
      allocation_id: string;
      course_id: string;
      class_id: string | null;
      semester_id: string | null;
      allocation_type: "workload" | "extra" | "fixed";
      total_lectures: number;
      rate: number;
      amount: number;
      attendance_ids: string[];
    }> = [];
    let totalAmount = 0;

    for (const it of d.items) {
      const allocRes = await client.query(
        `select al.id, al.course_id, al.teacher_id,
                (select s.id from allocation_semesters als join semesters s on s.id = als.semester_id
                 where als.allocation_id = al.id order by s.semester_number limit 1) as semester_id,
                (select s.class_id from allocation_semesters als join semesters s on s.id = als.semester_id
                 where als.allocation_id = al.id order by s.semester_number limit 1) as class_id
         from allocations al where al.id = $1`,
        [it.allocation_id]
      );
      const alloc = allocRes.rows[0];
      if (!alloc) throw new Error(`Allocation ${it.allocation_id} not found.`);
      if (alloc.teacher_id !== d.teacher_id) throw new Error("Allocation does not belong to the selected teacher.");

      const attendanceRes = await client.query<{ id: string; lecture_count: string }>(
        `select id, lecture_count
         from attendance_records
         where allocation_id = $1
           and bill_item_id is null
           and attendance_date between $2 and $3
         order by attendance_date, start_time
         for update`,
        [it.allocation_id, d.period_from, d.period_to]
      );
      const totalLectures = attendanceRes.rows.reduce(
        (sum, row) => sum + Number(row.lecture_count),
        0,
      );
      if (attendanceRes.rows.length === 0 || totalLectures <= 0) {
        throw new Error("No unbilled attendance found for one of the selected allocations in this period.");
      }

      // workload = 0 (institution cost, not billed)
      // extra    = lectures × rate  (per credit hour)
      // fixed    = flat rate  (no multiplier)
      const amount =
        it.allocation_type === "workload"   ? 0 :
        it.allocation_type === "extra"      ? it.rate * totalLectures :
        /* fixed */                           it.rate;
      totalAmount += amount;

      createdItems.push({
        allocation_id: it.allocation_id,
        course_id: alloc.course_id,
        class_id: alloc.class_id,
        semester_id: alloc.semester_id,
        allocation_type: it.allocation_type,
        total_lectures: totalLectures,
        rate: it.rate,
        amount,
        attendance_ids: attendanceRes.rows.map((row) => row.id),
      });
    }

    const billNumRes = await client.query(
      `select 'BILL-' || lpad(nextval('bill_number_seq')::text, 6, '0') as bill_number`
    );
    const billNumber = billNumRes.rows[0].bill_number;

    const billRes = await client.query(
      `insert into bills (bill_number, bill_type, teacher_id, department_id, billing_month, period_from, period_to, total_amount, status, generated_by)
       values ($1, 'permanent', $2, $3, $4, $5, $6, $7, 'unpaid', $8)
       returning *`,
      [billNumber, d.teacher_id, teacher.department_id, d.billing_month ?? null, d.period_from, d.period_to, totalAmount, session?.userId ?? null]
    );
    const bill = billRes.rows[0];

    const insertedItems: unknown[] = [];
    for (const ci of createdItems) {
      const itemRes = await client.query(
        `insert into bill_items (bill_id, allocation_id, course_id, class_id, semester_id, allocation_type, total_lectures, rate, amount)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *`,
        [bill.id, ci.allocation_id, ci.course_id, ci.class_id, ci.semester_id, ci.allocation_type, ci.total_lectures, ci.rate, ci.amount]
      );
      const item = itemRes.rows[0];
      insertedItems.push(item);
      const claimed = await client.query(
        `update attendance_records set bill_item_id = $1
         where id = any($2::uuid[]) and bill_item_id is null
         returning id`,
        [item.id, ci.attendance_ids]
      );
      if (claimed.rowCount !== ci.attendance_ids.length) {
        throw new Error("Some attendance was already billed. Refresh and try again.");
      }
    }

    await client.query("commit");
    return NextResponse.json({ bill: { ...bill, items: insertedItems } }, { status: 201 });
  } catch (err) {
    await client.query("rollback");
    const message = err instanceof Error ? err.message : "Failed to generate bill.";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
