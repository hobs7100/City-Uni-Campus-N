import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const patchSchema = z.object({
  wef_date: z.string().min(1),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "hod", "coordinator", "teacher", "student");
  if (response) return response;
  const { id } = await params;

  const timetable = await queryOne(
    `select tt.*, cl.class_name, cl.session, d.name as department_name,
            s.semester_number, s.term_type, s.status as semester_status
     from timetables tt
     join classes cl on cl.id = tt.class_id
     join departments d on d.id = tt.department_id
     join semesters s on s.id = tt.semester_id
     where tt.id = $1`,
    [id]
  );
  if (!timetable) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });

  const days = await query(
    `select id, day_name, position from timetable_days where timetable_id = $1 order by position`,
    [id]
  );
  const periods = await query(
    `select id, start_time, end_time, position from timetable_periods where timetable_id = $1 order by position`,
    [id]
  );
  const cells = await query(
    `select tc.id, tc.day_id, tc.period_id, tc.allocation_id,
            c.code as course_code, c.title as course_title,
            t.name as teacher_name, a.is_combined
     from timetable_cells tc
     left join allocations a on a.id = tc.allocation_id
     left join courses c on c.id = a.course_id
     left join teachers t on t.id = a.teacher_id
     where tc.timetable_id = $1`,
    [id]
  );

  return NextResponse.json({ timetable, days, periods, cells });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }

  const existing = await queryOne(`select id from timetables where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });

  const timetable = await queryOne(
    `update timetables set wef_date = $1, updated_at = now() where id = $2 returning *`,
    [parsed.data.wef_date, id]
  );
  return NextResponse.json({ timetable });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const existing = await queryOne(`select id from timetables where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });

  await query(`delete from timetables where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
