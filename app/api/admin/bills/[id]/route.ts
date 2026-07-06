import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const patchSchema = z.object({
  status: z.enum(["paid", "unpaid"]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }

  const existing = await queryOne(`select id from bills where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

  const bill = await queryOne<{ teacher_id: string; bill_number: string; status: string }>(
    `update bills set status = $1, updated_at = now() where id = $2 returning *`,
    [parsed.data.status, id]
  );

  if (bill && parsed.data.status === "paid") {
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
