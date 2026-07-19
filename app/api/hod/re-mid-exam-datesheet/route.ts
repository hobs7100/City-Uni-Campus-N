import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/hod/re-mid-exam-datesheet
// Returns re-mid datesheet for all active-semester courses in the HOD's department
// that have at least one mid-absent student.
export async function GET() {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const rows = await query<{
    course_id: string;
    course_code: string;
    course_title: string;
    credit_hours: string;
    class_name: string;
    sess: string;
    semester_id: string;
    semester_number: number;
    term_type: string;
    teacher_name: string;
    absent_count: number;
    paper_date: string | null;
    bundle_received_date: string | null;
    return_date: string | null;
  }>(
    `select distinct on (sc.course_id, s.id)
       sc.course_id,
       c.code                   as course_code,
       c.title                  as course_title,
       c.credit_hours::text     as credit_hours,
       cl.class_name,
       cl.session               as sess,
       s.id                     as semester_id,
       s.semester_number,
       s.term_type,
       coalesce(t.name, 'Not Assigned') as teacher_name,
       (
         select count(*) from results r
         where r.semester_id = s.id and r.course_id = sc.course_id and r.mid_absent = true
       )::int                   as absent_count,
       to_char(rmd.paper_date,           'YYYY-MM-DD') as paper_date,
       to_char(rmd.bundle_received_date, 'YYYY-MM-DD') as bundle_received_date,
       to_char(rmd.return_date,          'YYYY-MM-DD') as return_date
     from departments d
     join classes cl on cl.department_id = d.id
     join semesters s on s.class_id = cl.id and s.status = 'active'
     join semester_courses sc on sc.semester_id = s.id
     join courses c on c.id = sc.course_id
     left join allocation_semesters als on als.semester_id = s.id and als.course_id = sc.course_id
     left join allocations a on a.id = als.allocation_id
     left join teachers t on t.id = a.teacher_id
     left join re_mid_exam_datesheets rmd on rmd.semester_id = s.id and rmd.course_id = sc.course_id
     where d.hod_id = $1
       and exists (
         select 1 from results r
         where r.semester_id = s.id and r.course_id = sc.course_id and r.mid_absent = true
       )
     order by sc.course_id, s.id, c.title`,
    [session!.userId],
  );

  return NextResponse.json({ rows });
}
