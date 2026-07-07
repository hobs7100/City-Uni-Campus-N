import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const patchSchema = z.object({
  status: z.enum(["paid", "unpaid"]),
  payment_mode: z.enum(["bank_transfer", "cheque"]).optional().nullable(),
  cheque_number: z.string().max(6).optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator", "finance_manager");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }

  const existing = await queryOne(`select id from bills where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

  const { status, payment_mode, cheque_number } = parsed.data;

  // Compute values in JS to avoid CASE WHEN enum-vs-text comparison issues in PostgreSQL.
  const paidAt     = status === "paid" ? new Date().toISOString() : null;
  const pMode      = status === "paid" ? (payment_mode  ?? null)  : null;
  const chequeNum  = status === "paid" ? (cheque_number ?? null)  : null;

  const bill = await queryOne<{ teacher_id: string; bill_number: string; status: string }>(
    `update bills
     set status = $1, paid_at = $2, payment_mode = $3, cheque_number = $4, updated_at = now()
     where id = $5
     returning *`,
    [status, paidAt, pMode, chequeNum, id]
  );

  if (bill && status === "paid") {
    await query(
      `insert into notifications (recipient_type, recipient_id, title, message) values ('teacher', $1, $2, $3)`,
      [bill.teacher_id, "Bill paid", `Your bill ${bill.bill_number} has been marked as paid.`]
    ).catch((err) => console.error("Failed to create bill notification:", err));
  }

  return NextResponse.json({ bill });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const existing = await queryOne(`select id from bills where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

  await query(`delete from bills where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
