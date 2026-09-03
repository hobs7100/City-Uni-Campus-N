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
  status: z.enum(["ok", "fixture", "absent", "mid_term", "all_absent", "final_term"]).default("ok"),
  remarks: z.string().optional().nullable(),
});

function dayNameFor(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

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

  // A combined allocation remains actionable while any scheduled class-course
  // leg at this time is incomplete. Completed legs must not receive new records.
  const slotCompletion = await queryOne<{ has_completed_leg: boolean; has_incomplete_leg: boolean }>(
    `select
       bool_or(sc.syllabus_completed_at is not null) as has_completed_leg,
       bool_or(sc.syllabus_completed_at is null) as has_incomplete_leg
     from timetable_cells tc
     join timetable_days td on td.id = tc.day_id
     join timetable_periods tp on tp.id = tc.period_id
     join timetables tt on tt.id = tc.timetable_id
     join allocations a on a.id = tc.allocation_id
     join allocation_semesters als on als.allocation_id = tc.allocation_id and als.semester_id = tt.semester_id
     join semester_courses sc on sc.semester_id = tt.semester_id and sc.course_id = als.course_id
     where tc.allocation_id = $1
       and td.day_name = $2
       and tp.start_time = $3
       and tp.end_time = $4`,
    [d.allocation_id, dayNameFor(d.attendance_date), d.start_time, d.end_time]
  );
  if (slotCompletion?.has_completed_leg && !slotCompletion.has_incomplete_leg) {
    return NextResponse.json(
      { error: "Attendance cannot be marked because this course's syllabus is complete." },
      { status: 409 }
    );
  }

  const record = await queryOne<{ id: string; inserted: boolean }>(
    `insert into attendance_records (allocation_id, attendance_date, start_time, end_time, lecture_count, late_minutes, status, remarks, marked_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (allocation_id, attendance_date, start_time, end_time)
     do update set lecture_count = excluded.lecture_count, late_minutes = excluded.late_minutes,
                   status = excluded.status, remarks = excluded.remarks, marked_by = excluded.marked_by, updated_at = now()
      where attendance_records.bill_item_id is null
     returning *, (xmax = 0) as inserted`,
    [d.allocation_id, d.attendance_date, d.start_time, d.end_time, d.lecture_count, d.late_minutes, d.status, d.remarks ?? null, session?.userId ?? null]
  );
  if (!record) {
    return NextResponse.json(
      { error: "This attendance record has already been billed and cannot be edited." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { attendance: record },
    { status: record.inserted ? 201 : 200 },
  );
}
