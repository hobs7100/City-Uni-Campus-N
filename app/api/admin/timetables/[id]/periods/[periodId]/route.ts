import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id, periodId } = await params;

  const existing = await queryOne(
    `select id from timetable_periods where id = $1 and timetable_id = $2`,
    [periodId, id]
  );
  if (!existing) return NextResponse.json({ error: "Period not found." }, { status: 404 });

  await query(`delete from timetable_periods where id = $1`, [periodId]);
  await query(`update timetables set updated_at = now() where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
