import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { getCurrentAttendanceFine } from "@/lib/attendance-fines";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("discount"),
    student_id: z.string().uuid(),
    semester_id: z.string().uuid(),
    amount: z.coerce.number().positive(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("waive"),
    student_id: z.string().uuid(),
    semester_id: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("clear"),
    student_id: z.string().uuid(),
    semester_id: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
]);

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("admin");
  if (response) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid adjustment." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const fine = await getCurrentAttendanceFine(data.student_id);
  if (!fine || fine.semester_id !== data.semester_id || fine.gross_amount <= 0) {
    return NextResponse.json({ error: "No current attendance fine was found." }, { status: 404 });
  }

  const amount = data.action === "discount" ? data.amount : 0;
  if (data.action === "discount" && amount >= fine.gross_amount) {
    return NextResponse.json(
      { error: "Use waive-off when the full fine should be removed." },
      { status: 400 },
    );
  }
  const client = await getClient();
  try {
    await client.query("begin");
    const locked = await client.query<{
      attendance_fine_cycle_id: string;
      attendance_fine_cycle_started_at: string | null;
    }>(
      `select attendance_fine_cycle_id::text,
              attendance_fine_cycle_started_at::text
       from students
       where id = $1 and deleted_at is null
       for update`,
      [data.student_id],
    );
    const currentCycle = locked.rows[0];
    if (!currentCycle || currentCycle.attendance_fine_cycle_id !== fine.assessment_cycle_id) {
      await client.query("rollback");
      return NextResponse.json(
        { error: "The student's fine cycle changed. Refresh and try again." },
        { status: 409 },
      );
    }
    await client.query(
      `insert into attendance_fine_adjustments
         (student_id, semester_id, cycle_started_at, assessment_cycle_id,
          adjustment_type, discount_amount, reason, adjusted_by)
       values ($1, $2, coalesce($3::date, date '1970-01-01'),
               $4, $5, $6, $7, $8)`,
      [
        data.student_id,
        data.semester_id,
        currentCycle.attendance_fine_cycle_started_at,
        currentCycle.attendance_fine_cycle_id,
        data.action,
        amount,
        data.reason,
        session!.userId,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return NextResponse.json({
    success: true,
    attendance_fine: await getCurrentAttendanceFine(data.student_id),
  });
}