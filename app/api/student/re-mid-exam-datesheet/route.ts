import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/student/re-mid-exam-datesheet
// Returns re-mid datesheet entries only for courses where this student has mid_absent=true.
export async function GET() {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const rows = await query<{
    course_id: string;
    course_title: string;
    course_code: string;
    credit_hours: string;
    paper_date: string | null;
  }>(
    `select distinct on (r.course_id)
       r.course_id,
       c.title              as course_title,
       c.code               as course_code,
       c.credit_hours::text as credit_hours,
       to_char(rmd.paper_date, 'YYYY-MM-DD') as paper_date
     from results r
     join courses c on c.id = r.course_id
     join semesters s on s.id = r.semester_id and s.status = 'active'
     left join re_mid_exam_datesheets rmd on rmd.semester_id = r.semester_id and rmd.course_id = r.course_id
     where r.student_id = $1
       and r.mid_absent = true
     order by r.course_id, c.title`,
    [session!.userId],
  );

  return NextResponse.json({ rows });
}
