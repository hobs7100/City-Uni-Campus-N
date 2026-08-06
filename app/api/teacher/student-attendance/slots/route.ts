import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

/**
 * GET /api/teacher/student-attendance/slots?allocation_id=...&date=YYYY-MM-DD
 *
 * Returns the timetable time-slots for this allocation on the given weekday.
 * Used by the teacher dashboard to decide whether to show a slot picker
 * (when there are 2+ slots on the same day) before loading the roster.
 */
export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const allocationId = request.nextUrl.searchParams.get("allocation_id");
  const date         = request.nextUrl.searchParams.get("date");

  if (!allocationId || !date) {
    return NextResponse.json(
      { error: "allocation_id and date are required." },
      { status: 400 }
    );
  }

  // Verify this allocation belongs to the requesting teacher
  const allocation = await queryOne<{ id: string }>(
    `select a.id from allocations a where a.id = $1 and a.teacher_id = $2`,
    [allocationId, session!.userId]
  );
  if (!allocation) {
    return NextResponse.json(
      { error: "Allocation not found or not yours." },
      { status: 403 }
    );
  }

  // Convert the ISO date to a weekday name (e.g. "Monday") matching timetable_days.day_name
  const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });

  // Fetch distinct slots from all timetables where this allocation appears on this weekday
  const slots = await query<{ start_time: string; end_time: string }>(
    `select distinct tp.start_time, tp.end_time
     from timetable_cells tc
     join timetable_days    td on td.id = tc.day_id
     join timetable_periods tp on tp.id = tc.period_id
     where tc.allocation_id = $1
       and td.day_name       = $2
     order by tp.start_time`,
    [allocationId, dayName]
  );

  return NextResponse.json({ slots });
}
