import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/teacher/mid-exam-datesheet
// Returns datesheet rows for all active-semester courses taught by the logged-in teacher.
export async function GET() {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const rows = await query<{
    course_id: string;
    course_code: string;
    course_title: string;
    credit_hours: string;
    teacher_name: string;
    class_name: string;
    session: string;
    semester_id: string;
    semester_number: number;
    term_type: string;
    paper_date: string | null;
    bundle_received_date: string | null;
    return_date: string | null;
    result_uploaded: boolean;
  }>(
    `select distinct on (als.course_id, s.id)
       als.course_id,
       c.code                   as course_code,
       c.title                  as course_title,
       c.credit_hours::text     as credit_hours,
       t.name                   as teacher_name,
       cl.class_name,
       cl.session,
       s.id                     as semester_id,
       s.semester_number,
       s.term_type,
       to_char(med.paper_date,           'YYYY-MM-DD') as paper_date,
       to_char(med.bundle_received_date, 'YYYY-MM-DD') as bundle_received_date,
       to_char(med.return_date,          'YYYY-MM-DD') as return_date,
       exists (
         select 1 from results r
         where r.semester_id = s.id and r.course_id = als.course_id
       ) as result_uploaded
     from allocation_semesters als
     join semesters s  on s.id  = als.semester_id  and s.status = 'active'
     join courses c    on c.id  = als.course_id
     join allocations a on a.id = als.allocation_id and a.teacher_id = $1
     join teachers t   on t.id  = a.teacher_id
     join classes cl   on cl.id = s.class_id
     left join mid_exam_datesheets med on med.semester_id = s.id and med.course_id = als.course_id
     order by als.course_id, s.id, c.title`,
    [session!.userId],
  );

  return NextResponse.json({ rows });
}
