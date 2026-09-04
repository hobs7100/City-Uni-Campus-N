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
  const allocation = await queryOne<{ id: string; is_combined: boolean }>(
    `select a.id, a.is_combined from allocations a where a.id = $1 and a.teacher_id = $2`,
    [allocationId, session!.userId]
  );
  if (!allocation) {
    return NextResponse.json(
      { error: "Allocation not found or not yours." },
      { status: 403 }
    );
  }

  // Completion is per class-semester-course. A combined allocation remains
  // available when at least one of its active class legs is unfinished.
  const incompleteLeg = await queryOne<{ id: string }>(
    `select s.id
     from allocation_semesters als
     join semesters s on s.id = als.semester_id
     join allocations a on a.id = als.allocation_id
     left join semester_courses sc
       on sc.semester_id = s.id and sc.course_id = a.course_id
     where als.allocation_id = $1
       and s.status = 'active'
       and sc.syllabus_completed_at is null
     limit 1`,
    [allocationId]
  );
  if (!incompleteLeg) {
    return NextResponse.json(
      { error: "Syllabus is complete for this course. Attendance can no longer be marked." },
      { status: 403 }
    );
  }

  // Convert the ISO date to a weekday name (e.g. "Monday") matching timetable_days.day_name
  const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });

  // A combined allocation is one physical lecture shared by every linked class.
  // Its cells may be anchored in any one of those class timetables, so enumerate
  // every distinct slot assigned to the shared allocation ID.
  const slots = await query<{ start_time: string; end_time: string }>(
    `select distinct tp.start_time, tp.end_time
     from timetable_cells tc
     join timetable_days    td on td.id = tc.day_id
     join timetable_periods tp on tp.id = tc.period_id
     join timetables tt on tt.id = tc.timetable_id
     join allocation_semesters als
       on als.allocation_id = tc.allocation_id
      and als.semester_id = tt.semester_id
     join semesters s
       on s.id = als.semester_id
      and s.status = 'active'
     join semester_courses sc
       on sc.semester_id = als.semester_id
      and sc.course_id = als.course_id
      and sc.syllabus_completed_at is null
     where tc.allocation_id = $1
       and td.day_name       = $2
     order by tp.start_time, tp.end_time`,
    [allocationId, dayName]
  );

  return NextResponse.json({ slots, is_combined: allocation.is_combined });
}
