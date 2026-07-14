import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  allocation_id: z.string().uuid().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cellId: string }> }
) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id, cellId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const { allocation_id } = parsed.data;

  const cell = await queryOne<{ id: string; day_id: string; period_id: string; timetable_id: string }>(
    `select id, day_id, period_id, timetable_id from timetable_cells where id = $1 and timetable_id = $2`,
    [cellId, id]
  );
  if (!cell) return NextResponse.json({ error: "Cell not found." }, { status: 404 });

  if (allocation_id === null) {
    const updated = await queryOne(
      `update timetable_cells set allocation_id = null, updated_at = now() where id = $1 returning *`,
      [cellId]
    );
    await query(`update timetables set updated_at = now() where id = $1`, [id]);
    return NextResponse.json({ cell: updated });
  }

  const timetable = await queryOne<{ semester_id: string }>(
    `select semester_id from timetables where id = $1`,
    [id]
  );
  if (!timetable) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });

  const allocation = await queryOne<{ id: string; teacher_id: string; teacher_name: string; is_combined: boolean }>(
    `select a.id, a.teacher_id, a.is_combined, t.name as teacher_name
     from allocations a
     join teachers t on t.id = a.teacher_id
     where a.id = $1`,
    [allocation_id]
  );
  if (!allocation) return NextResponse.json({ error: "Allocation not found." }, { status: 404 });

  const inSemester = await queryOne(
    `select 1 from allocation_semesters where allocation_id = $1 and semester_id = $2`,
    [allocation_id, timetable.semester_id]
  );
  if (!inSemester) {
    return NextResponse.json(
      { error: "This allocation is not part of this timetable's semester." },
      { status: 400 }
    );
  }

  const day = await queryOne<{ day_name: string }>(`select day_name from timetable_days where id = $1`, [cell.day_id]);
  const period = await queryOne<{ start_time: string; end_time: string }>(
    `select start_time, end_time from timetable_periods where id = $1`,
    [cell.period_id]
  );
  if (!day || !period) return NextResponse.json({ error: "Cell context not found." }, { status: 404 });

  const clash = await queryOne<{ class_name: string; session: string }>(
    `select cl.class_name, cl.session
     from timetable_cells tc
     join timetable_days td on td.id = tc.day_id
     join timetable_periods tp on tp.id = tc.period_id
     join timetables tt on tt.id = tc.timetable_id
     join classes cl on cl.id = tt.class_id
     join allocations a on a.id = tc.allocation_id
     where tc.allocation_id is not null
       and tc.id != $1
       and a.teacher_id = $2
       and tc.allocation_id != $3
       and td.day_name = $4
       and tp.start_time < $5
       and tp.end_time > $6
       -- Allow same-title courses even with different codes (combined-class scenario)
       and (
         select lower(c.title)
         from allocation_semesters ase
         join courses c on c.id = ase.course_id
         where ase.allocation_id = tc.allocation_id
         limit 1
       ) is distinct from (
         select lower(c.title)
         from allocation_semesters ase
         join courses c on c.id = ase.course_id
         where ase.allocation_id = $3
         limit 1
       )
     limit 1`,
    [cellId, allocation.teacher_id, allocation_id, day.day_name, period.end_time, period.start_time]
  );
  if (clash) {
    return NextResponse.json(
      {
        error: `Teacher clash: ${allocation.teacher_name} is already scheduled in ${clash.class_name} (${clash.session}) on ${day.day_name} at this time.`,
      },
      { status: 409 }
    );
  }

  // For combined lectures: if already placed in another timetable, the slot must match
  if (allocation.is_combined) {
    const existingPlacement = await queryOne<{
      day_name: string;
      start_time: string;
      end_time: string;
      class_name: string;
      session: string;
    }>(
      `select td.day_name, tp.start_time, tp.end_time, cl.class_name, cl.session
       from timetable_cells tc
       join timetable_days td on td.id = tc.day_id
       join timetable_periods tp on tp.id = tc.period_id
       join timetables tt on tt.id = tc.timetable_id
       join classes cl on cl.id = tt.class_id
       where tc.allocation_id = $1
         and tc.id != $2
         and tc.timetable_id != $3
       limit 1`,
      [allocation_id, cellId, id]
    );
    if (
      existingPlacement &&
      (existingPlacement.day_name !== day.day_name ||
        existingPlacement.start_time !== period.start_time ||
        existingPlacement.end_time !== period.end_time)
    ) {
      return NextResponse.json(
        {
          error: `Combined lecture already placed in ${existingPlacement.class_name} (${existingPlacement.session}) on ${existingPlacement.day_name} ${existingPlacement.start_time}–${existingPlacement.end_time}. All combined classes must share the exact same slot.`,
        },
        { status: 409 }
      );
    }
  }

  const updated = await queryOne(
    `update timetable_cells set allocation_id = $1, updated_at = now() where id = $2 returning *`,
    [allocation_id, cellId]
  );
  await query(`update timetables set updated_at = now() where id = $1`, [id]);
  return NextResponse.json({ cell: updated });
}
