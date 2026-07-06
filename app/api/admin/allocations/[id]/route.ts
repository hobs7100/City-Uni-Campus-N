import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const existing = await queryOne(`select id from allocations where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Allocation not found." }, { status: 404 });

  await query(`delete from allocations where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
