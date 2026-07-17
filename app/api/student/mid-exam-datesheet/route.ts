import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/student/mid-exam-datesheet
// Returns limited datesheet rows (course title, credit hours, paper date only)
// for the student's current active semester.
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
    `select distinct on (sc.course_id)
       sc.course_id,
       c.title              as course_title,
       c.code               as course_code,
       c.credit_hours::text as credit_hours,
       to_char(med.paper_date, 'YYYY-MM-DD') as paper_date
     from students st
     join semesters s       on s.class_id   = st.class_id and s.status = 'active'
     join semester_courses sc on sc.semester_id = s.id
     join courses c          on c.id         = sc.course_id
     left join mid_exam_datesheets med
       on med.semester_id = s.id and med.course_id = sc.course_id
     where st.id = $1
     order by sc.course_id, c.title`,
    [session!.userId],
  );

  return NextResponse.json({ rows });
}
