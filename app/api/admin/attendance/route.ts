import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  allocation_id: z.string().uuid(),
  attendance_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  lecture_count: z.coerce.number().min(0).max(1),
  late_minutes: z.coerce.number().int().min(0).default(0),
  status: z.enum(["ok", "fixture"]).default("ok"),
  remarks: z.string().optional().nullable(),
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

  const allocation = await queryOne(`select id from allocations where id = $1`, [d.allocation_id]);
  if (!allocation) return NextResponse.json({ error: "Allocation not found." }, { status: 404 });

  const existing = await queryOne<{ id: string; bill_item_id: string | null }>(
    `select id, bill_item_id from attendance_records
     where allocation_id = $1 and attendance_date = $2 and start_time = $3 and end_time = $4`,
    [d.allocation_id, d.attendance_date, d.start_time, d.end_time]
  );
  if (existing?.bill_item_id) {
    return NextResponse.json({ error: "This attendance record has already been billed and cannot be edited." }, { status: 409 });
  }

  const record = await queryOne(
    `insert into attendance_records (allocation_id, attendance_date, start_time, end_time, lecture_count, late_minutes, status, remarks, marked_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (allocation_id, attendance_date, start_time, end_time)
     do update set lecture_count = excluded.lecture_count, late_minutes = excluded.late_minutes,
                   status = excluded.status, remarks = excluded.remarks, marked_by = excluded.marked_by, updated_at = now()
     returning *`,
    [d.allocation_id, d.attendance_date, d.start_time, d.end_time, d.lecture_count, d.late_minutes, d.status, d.remarks ?? null, session?.userId ?? null]
  );

  return NextResponse.json({ attendance: record }, { status: existing ? 200 : 201 });
}
