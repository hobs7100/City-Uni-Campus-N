import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/teacher/re-mid-exam-datesheet
// Returns re-mid datesheet rows for courses taught by the logged-in teacher
// that have at least one mid-absent student in the active semester.
export async function GET() {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const rows = await query<{
    course_id: string;
    course_code: string;
    course_title: string;
    credit_hours: string;
    class_name: string;
    session: string;
    semester_id: string;
    semester_number: number;
    term_type: string;
    absent_count: number;
    paper_date: string | null;
    bundle_received_date: string | null;
    return_date: string | null;
  }>(
    `select distinct on (als.course_id, s.id)
       als.course_id,
       c.code                   as course_code,
       c.title                  as course_title,
       c.credit_hours::text     as credit_hours,
       cl.class_name,
       cl.session,
       s.id                     as semester_id,
       s.semester_number,
       s.term_type,
       (
         select count(*) from results r
         where r.semester_id = s.id and r.course_id = als.course_id and r.mid_absent = true
       )::int                   as absent_count,
       to_char(rmd.paper_date,           'YYYY-MM-DD') as paper_date,
       to_char(rmd.bundle_received_date, 'YYYY-MM-DD') as bundle_received_date,
       to_char(rmd.return_date,          'YYYY-MM-DD') as return_date
     from allocation_semesters als
     join semesters s   on s.id  = als.semester_id  and s.status = 'active'
     join courses c     on c.id  = als.course_id
     join allocations a on a.id  = als.allocation_id and a.teacher_id = $1
     join classes cl    on cl.id = s.class_id
     left join re_mid_exam_datesheets rmd on rmd.semester_id = s.id and rmd.course_id = als.course_id
     where exists (
       select 1 from results r
       where r.semester_id = s.id and r.course_id = als.course_id and r.mid_absent = true
     )
     order by als.course_id, s.id, c.title`,
    [session!.userId],
  );

  return NextResponse.json({ rows });
}
