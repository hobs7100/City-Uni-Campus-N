import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  department_id: z.string().uuid(),
  class_id: z.string().uuid(),
  semester_id: z.string().uuid(),
  shift: z.enum(["morning", "evening"]),
  wef_date: z.string().min(1),
});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function defaultPeriods(shift: "morning" | "evening") {
  const ranges: { start: number; end: number }[] = [];
  const startHour = shift === "morning" ? 8 : 11;
  const endHour = shift === "morning" ? 13 : 17;
  for (let h = startHour; h < endHour; h++) {
    ranges.push({ start: h, end: h + 1 });
  }
  return ranges.map((r) => ({
    start_time: `${String(r.start).padStart(2, "0")}:00:00`,
    end_time: `${String(r.end).padStart(2, "0")}:00:00`,
  }));
}

export async function GET() {
  const { response } = await requireRole("admin", "hod", "coordinator", "teacher", "student");
  if (response) return response;

  const timetables = await query(
    `select tt.*, cl.class_name, cl.session, d.name as department_name,
            s.semester_number, s.term_type, s.status as semester_status
     from timetables tt
     join classes cl on cl.id = tt.class_id
     join departments d on d.id = tt.department_id
     join semesters s on s.id = tt.semester_id
     order by tt.updated_at desc`
  );
  return NextResponse.json({ timetables });
}

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const semester = await queryOne<{ id: string; class_id: string; department_id: string; status: string }>(
    `select id, class_id, department_id, status from semesters where id = $1`,
    [d.semester_id]
  );
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });
  if (semester.class_id !== d.class_id) {
    return NextResponse.json({ error: "Selected semester does not belong to the selected class." }, { status: 400 });
  }
  if (semester.department_id !== d.department_id) {
    return NextResponse.json({ error: "Selected class does not belong to the selected department." }, { status: 400 });
  }
  if (semester.status !== "active") {
    return NextResponse.json({ error: "The selected class does not have an active semester." }, { status: 400 });
  }

  const existing = await queryOne(
    `select id from timetables where class_id = $1 and semester_id = $2`,
    [d.class_id, d.semester_id]
  );
  if (existing) {
    return NextResponse.json({ error: "A timetable already exists for this class and semester." }, { status: 409 });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const ttResult = await client.query(
      `insert into timetables (department_id, class_id, semester_id, shift, wef_date)
       values ($1, $2, $3, $4, $5) returning *`,
      [d.department_id, d.class_id, d.semester_id, d.shift, d.wef_date]
    );
    const timetable = ttResult.rows[0];

    const dayRows: { id: string }[] = [];
    for (let i = 0; i < DAYS.length; i++) {
      const r = await client.query(
        `insert into timetable_days (timetable_id, day_name, position) values ($1, $2, $3) returning id`,
        [timetable.id, DAYS[i], i]
      );
      dayRows.push(r.rows[0]);
    }

    const periods = defaultPeriods(d.shift);
    const periodRows: { id: string }[] = [];
    for (let i = 0; i < periods.length; i++) {
      const r = await client.query(
        `insert into timetable_periods (timetable_id, start_time, end_time, position) values ($1, $2, $3, $4) returning id`,
        [timetable.id, periods[i].start_time, periods[i].end_time, i]
      );
      periodRows.push(r.rows[0]);
    }

    for (const day of dayRows) {
      for (const period of periodRows) {
        await client.query(
          `insert into timetable_cells (timetable_id, day_id, period_id) values ($1, $2, $3)`,
          [timetable.id, day.id, period.id]
        );
      }
    }

    await client.query("commit");
    return NextResponse.json({ timetable }, { status: 201 });
  } catch (err: unknown) {
    await client.query("rollback");
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json({ error: "A timetable already exists for this class and semester." }, { status: 409 });
    }
    console.error("Failed to create timetable:", err);
    return NextResponse.json({ error: "Failed to create timetable." }, { status: 500 });
  } finally {
    client.release();
  }
}
