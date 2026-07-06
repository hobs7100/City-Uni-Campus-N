import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id, dayId } = await params;

  const existing = await queryOne(
    `select id from timetable_days where id = $1 and timetable_id = $2`,
    [dayId, id]
  );
  if (!existing) return NextResponse.json({ error: "Day not found." }, { status: 404 });

  await query(`delete from timetable_days where id = $1`, [dayId]);
  await query(`update timetables set updated_at = now() where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
