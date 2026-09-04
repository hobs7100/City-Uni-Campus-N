import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  teacher_id: z.string().uuid(),
  period_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((value) => value.period_from <= value.period_to, {
  message: "From date cannot be after To date.",
  path: ["period_to"],
});

type LockedAttendance = {
  id: string;
  allocation_id: string;
  lecture_count: string;
  attendance_date: string;
};

type ResolvedAllocation = {
  allocation_id: string;
  allocation_type: string;
  rate: string;
  course_id: string;
  course_code: string;
  course_title: string;
  class_id: string;
  class_name: string;
  session: string;
  semester_id: string;
  semester_number: number;
};

type PreparedItem = Omit<ResolvedAllocation, "rate"> & {
  attendance: LockedAttendance[];
  billingPeriodMonth: string | null;
  totalLectures: number;
  rate: number;
  amount: number;
};

export async function POST(request: NextRequest) {
  const { response, session } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const client = await getClient();

  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [d.teacher_id]);

    const teacherRes = await client.query<{
      id: string;
      name: string;
      department_id: string;
      department_name: string;
    }>(
      `select te.id, te.name, te.department_id, dep.name as department_name
       from teachers te
       join departments dep on dep.id = te.department_id
       where te.id = $1 and te.type = 'visiting' and te.deleted_at is null`,
      [d.teacher_id],
    );
    const teacher = teacherRes.rows[0];
    if (!teacher) throw new Error("Visiting teacher not found.");

    const attendanceRes = await client.query<LockedAttendance>(
      `select ar.id, ar.allocation_id, ar.lecture_count, ar.attendance_date::text
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
       order by ar.allocation_id, ar.attendance_date, ar.start_time
       for update of ar`,
      [d.teacher_id, d.period_from, d.period_to],
    );
    if (attendanceRes.rows.length === 0) {
      throw new Error("No unbilled attendance found for this teacher in the selected period.");
    }

    const attendanceByAllocation = new Map<string, LockedAttendance[]>();
    for (const row of attendanceRes.rows) {
      const rows = attendanceByAllocation.get(row.allocation_id) ?? [];
      rows.push(row);
      attendanceByAllocation.set(row.allocation_id, rows);
    }

    const allocationIds = Array.from(attendanceByAllocation.keys());
    const allocationRes = await client.query<ResolvedAllocation>(
      `select distinct on (al.id)
              al.id as allocation_id,
              al.allocation_type,
              al.rate::text,
              c.id as course_id,
              c.code as course_code,
              c.title as course_title,
              cl.id as class_id,
              cl.class_name,
              cl.session,
              s.id as semester_id,
              s.semester_number
       from allocations al
       join courses c on c.id = al.course_id
       join allocation_semesters als on als.allocation_id = al.id
       join semesters s on s.id = als.semester_id
       join classes cl on cl.id = s.class_id
        where al.id = any($1::uuid[]) and al.teacher_id = $2
       order by al.id,
                case when s.status = 'active' then 0 else 1 end,
                s.start_date desc`,
      [allocationIds, d.teacher_id],
    );
    if (allocationRes.rows.length !== allocationIds.length) {
      throw new Error("One or more billable allocations could not be resolved.");
    }

    const prepared = allocationRes.rows.flatMap<PreparedItem>((allocation) => {
      const attendance = attendanceByAllocation.get(allocation.allocation_id) ?? [];
      const rate = Number(allocation.rate);
      if (allocation.allocation_type !== "fixed") {
        const totalLectures = attendance.reduce(
          (sum, row) => sum + Number(row.lecture_count),
          0,
        );
        return [{
          ...allocation,
          attendance,
          billingPeriodMonth: null,
          totalLectures,
          rate,
          amount: rate * totalLectures,
        }];
      }

      const attendanceByMonth = new Map<string, LockedAttendance[]>();
      for (const row of attendance) {
        const month = `${row.attendance_date.slice(0, 7)}-01`;
        const monthlyRows = attendanceByMonth.get(month) ?? [];
        monthlyRows.push(row);
        attendanceByMonth.set(month, monthlyRows);
      }
      return Array.from(attendanceByMonth.entries()).map(([month, monthlyAttendance]) => ({
        ...allocation,
        attendance: monthlyAttendance,
        billingPeriodMonth: month,
        totalLectures: monthlyAttendance.reduce(
          (sum, row) => sum + Number(row.lecture_count),
          0,
        ),
        rate,
        amount: rate,
      }));
    }).filter((item) => item.totalLectures > 0);
    if (prepared.length === 0) {
      throw new Error("No billable lectures were found in the selected period.");
    }

    const billNumberRes = await client.query<{ bill_number: string }>(
      `select 'BILL-' || lpad(nextval('bill_number_seq')::text, 6, '0') as bill_number`,
    );
    const billNumber = billNumberRes.rows[0].bill_number;
    const totalAmount = prepared.reduce((sum, item) => sum + item.amount, 0);
    const billingMonth = `${d.period_from} to ${d.period_to}`;
    const billRes = await client.query(
      `insert into bills
         (bill_number, bill_type, teacher_id, department_id, billing_month,
          period_from, period_to, total_amount, status, generated_by)
       values ($1, 'visiting', $2, $3, $4, $5, $6, $7, 'unpaid', $8)
       returning *`,
      [
        billNumber,
        teacher.id,
        teacher.department_id,
        billingMonth,
        d.period_from,
        d.period_to,
        totalAmount,
        session?.userId ?? null,
      ],
    );
    const bill = billRes.rows[0];
    const outItems: unknown[] = [];

    for (const item of prepared) {
      const itemRes = await client.query(
        `insert into bill_items
           (bill_id, allocation_id, course_id, class_id, semester_id,
            allocation_type, total_lectures, rate, amount, billing_period_month)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         returning *`,
        [
          bill.id,
          item.allocation_id,
          item.course_id,
          item.class_id,
          item.semester_id,
          item.allocation_type,
          item.totalLectures,
          item.rate,
          item.amount,
          item.billingPeriodMonth,
        ],
      );
      const billItem = itemRes.rows[0];
      const attendanceIds = item.attendance.map((row) => row.id);
      const claimed = await client.query(
        `update attendance_records
         set bill_item_id = $1
         where id = any($2::uuid[]) and bill_item_id is null
         returning id`,
        [billItem.id, attendanceIds],
      );
      if (claimed.rowCount !== attendanceIds.length) {
        throw new Error("Some attendance was already billed. Refresh and try again.");
      }

      const appendixRes = await client.query(
        `select attendance_date, lecture_count, late_minutes, status
         from attendance_records
         where bill_item_id = $1
         order by attendance_date, start_time`,
        [billItem.id],
      );
      outItems.push({
        ...billItem,
        course_code: item.course_code,
        course_title: item.course_title,
        class_name: item.class_name,
        session: item.session,
        semester_number: item.semester_number,
        teacher_name: teacher.name,
        attendance: appendixRes.rows,
      });
    }

    await client.query("commit");
    return NextResponse.json(
      {
        bill: {
          ...bill,
          teacher_name: teacher.name,
          department_name: teacher.department_name,
          items: outItems,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    await client.query("rollback");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate custom bill." },
      { status: 400 },
    );
  } finally {
    client.release();
  }
}