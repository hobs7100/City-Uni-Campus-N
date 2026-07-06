import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z
  .object({
    start_time: z.string().min(1),
    end_time: z.string().min(1),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: "End time must be after start time.",
    path: ["end_time"],
  });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const timetable = await queryOne(`select id from timetables where id = $1`, [id]);
  if (!timetable) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const overlap = await queryOne(
    `select 1 from timetable_periods where timetable_id = $1 and start_time < $3 and end_time > $2`,
    [id, d.start_time, d.end_time]
  );
  if (overlap) {
    return NextResponse.json({ error: "This time range overlaps with an existing period." }, { status: 409 });
  }

  const maxPos = await queryOne<{ max: number | null }>(
    `select max(position) as max from timetable_periods where timetable_id = $1`,
    [id]
  );
  const nextPos = (maxPos?.max ?? -1) + 1;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const periodResult = await client.query(
      `insert into timetable_periods (timetable_id, start_time, end_time, position) values ($1, $2, $3, $4) returning *`,
      [id, d.start_time, d.end_time, nextPos]
    );
    const period = periodResult.rows[0];

    const days = await client.query(`select id from timetable_days where timetable_id = $1`, [id]);
    for (const day of days.rows) {
      await client.query(
        `insert into timetable_cells (timetable_id, day_id, period_id) values ($1, $2, $3)`,
        [id, day.id, period.id]
      );
    }

    await client.query(`update timetables set updated_at = now() where id = $1`, [id]);
    await client.query("commit");
    return NextResponse.json({ period }, { status: 201 });
  } catch (err) {
    await client.query("rollback");
    console.error("Failed to add period:", err);
    return NextResponse.json({ error: "Failed to add period." }, { status: 500 });
  } finally {
    client.release();
  }
}
