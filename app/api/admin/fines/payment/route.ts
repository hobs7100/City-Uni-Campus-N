import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { getCurrentAttendanceFine } from "@/lib/attendance-fines";
import { requirePortalPermission } from "@/lib/portalPermissions";

const schema = z.object({
  student_id: z.string().uuid(),
  semester_id: z.string().uuid(),
  assessment_cycle_id: z.string().uuid(),
  fid: z.string().trim().min(1).max(100),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid payment date."),
  fine_quote: z.object({
    presents: z.number().int().nonnegative(), evaluable_days: z.number().int().nonnegative(),
    gross_amount: z.number().nonnegative(), discount_amount: z.number().nonnegative(),
    paid_amount: z.number().nonnegative(), net_amount: z.number().positive(),
    adjustment_type: z.enum(["discount", "waive"]).nullable(), adjusted_at: z.string().nullable(),
  }),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requirePortalPermission("fines", "edit", "admin", "coordinator", "finance_manager");
  if (response) return response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment." }, { status: 400 });
  const data = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const locked = await client.query<{ status: string }>(
      "select status::text from students where id=$1 and deleted_at is null for update", [data.student_id],
    );
    if (!locked.rows[0] || !["active", "permanent_leave"].includes(locked.rows[0].status)) {
      await client.query("rollback");
      return NextResponse.json({ error: "Only active or permanent-leave students may pay through this action. Use reactivation for struck-off students." }, { status: 409 });
    }
    const fine = await getCurrentAttendanceFine(data.student_id, client);
    if (!fine || fine.is_protected || fine.net_amount <= 0
      || fine.semester_id !== data.semester_id || fine.assessment_cycle_id !== data.assessment_cycle_id
      || Object.entries(data.fine_quote).some(([key, value]) => fine[key as keyof typeof data.fine_quote] !== value)) {
      await client.query("rollback");
      return NextResponse.json({ error: "The fine has changed or is no longer payable. Refresh the assessment before collecting payment.", code: "STALE_FINE_QUOTE" }, { status: 409 });
    }
    const validDate = await client.query<{ valid: boolean }>(
      "select $1::date <= (now() at time zone 'Asia/Karachi')::date as valid", [data.paid_date],
    );
    if (!validDate.rows[0].valid) {
      await client.query("rollback");
      return NextResponse.json({ error: "Payment date cannot be in the future." }, { status: 400 });
    }
    const saved = await client.query<{ id: string }>(
      `insert into student_fines
        (student_id,department_id,class_id,semester_id,amount,fid,paid_date,reactivated_on,
         created_by_name,gross_amount,discount_amount,adjustment_type,assessment_cycle_id)
       values($1,$2,$3,$4,$5,$6,$7::date,null,$8,$9,$10,$11,$12) returning id`,
      [fine.student_id, fine.department_id, fine.class_id, fine.semester_id, fine.net_amount,
        data.fid, data.paid_date, session!.name, fine.gross_amount, fine.discount_amount,
        fine.adjustment_type, fine.assessment_cycle_id],
    );
    await client.query("commit");
    return NextResponse.json({ success: true, payment_id: saved.rows[0].id, amount: fine.net_amount });
  } catch (error) {
    await client.query("rollback");
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This FID has already been used." }, { status: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}
