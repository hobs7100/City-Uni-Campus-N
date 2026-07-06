import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  day_name: z.string().trim().min(1).max(20),
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

  const existing = await queryOne(
    `select id from timetable_days where timetable_id = $1 and day_name = $2`,
    [id, d.day_name]
  );
  if (existing) {
    return NextResponse.json({ error: "This day already exists in the timetable." }, { status: 409 });
  }

  const maxPos = await queryOne<{ max: number | null }>(
    `select max(position) as max from timetable_days where timetable_id = $1`,
    [id]
  );
  const nextPos = (maxPos?.max ?? -1) + 1;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const dayResult = await client.query(
      `insert into timetable_days (timetable_id, day_name, position) values ($1, $2, $3) returning *`,
      [id, d.day_name, nextPos]
    );
    const day = dayResult.rows[0];

    const periods = await client.query(`select id from timetable_periods where timetable_id = $1`, [id]);
    for (const period of periods.rows) {
      await client.query(
        `insert into timetable_cells (timetable_id, day_id, period_id) values ($1, $2, $3)`,
        [id, day.id, period.id]
      );
    }

    await client.query(`update timetables set updated_at = now() where id = $1`, [id]);
    await client.query("commit");
    return NextResponse.json({ day }, { status: 201 });
  } catch (err) {
    await client.query("rollback");
    console.error("Failed to add day:", err);
    return NextResponse.json({ error: "Failed to add day." }, { status: 500 });
  } finally {
    client.release();
  }
}
