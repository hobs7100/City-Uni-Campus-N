import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/teacher/dit/courses
// Returns all active DIT allocations (distinct per allocation+class+semester)
// for the logged-in teacher — used to populate DIT Results tab selectors.
export async function GET() {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const rows = await query<{
    allocation_id: string;
    course_id: string;
    course_code: string;
    course_title: string;
    semester_id: string;
    semester_number: number;
    term_type: string;
    class_id: string;
    class_name: string;
    session: string;
  }>(
    `select distinct
            a.id          as allocation_id,
            co.id         as course_id,
            co.code       as course_code,
            co.title      as course_title,
            sem.id        as semester_id,
            sem.semester_number,
            sem.term_type,
            cl.id         as class_id,
            cl.class_name,
            cl.session
     from allocations a
     join courses co               on co.id  = a.course_id
     join allocation_semesters als on als.allocation_id = a.id
     join semesters sem            on sem.id = als.semester_id
     join classes cl               on cl.id  = sem.class_id
     where a.teacher_id  = $1
       and a.status       = 'active'
       and sem.status     = 'active'
       and cl.type        = 'DIT'
     order by cl.class_name, sem.semester_number, co.title`,
    [session!.userId]
  );

  return NextResponse.json({ courses: rows });
}
