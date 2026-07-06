import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const timetables = await query(
    `select distinct tt.id, tt.shift, tt.wef_date, cl.class_name, cl.session,
            s.semester_number, s.term_type, tt.updated_at
     from timetables tt
     join classes cl on cl.id = tt.class_id
     join semesters s on s.id = tt.semester_id
     join timetable_cells tc on tc.timetable_id = tt.id
     join allocations a on a.id = tc.allocation_id
     where a.teacher_id = $1 and s.status = 'active'
     order by tt.updated_at desc`,
    [session!.userId]
  );

  return NextResponse.json({ timetables });
}
