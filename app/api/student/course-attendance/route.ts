import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const studentId = session!.userId;

  const student = await queryOne<{ class_id: string }>(
    `select class_id from students where id = $1 and deleted_at is null`,
    [studentId]
  );
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const classId = student.class_id;

  const semesters = await query<{
    id: string; semester_number: number; term_type: string; status: string;
  }>(
    `select id, semester_number, term_type, status
     from semesters
     where class_id = $1 and status in ('active','closed')
     order by semester_number`,
    [classId]
  );

  if (semesters.length === 0) return NextResponse.json({ semesters: [] });

  const result = [];

  for (const sem of semesters) {
    /* course-wise counts: map daily attendance to courses via timetable day-of-week */
    const courseRows = await query<{
      course_id: string; course_title: string; course_code: string;
      teacher_name: string; presents: string; absents: string; leaves: string;
    }>(
      `with tt as (
         select id as timetable_id
         from timetables
         where class_id = $2 and semester_id = $1
         limit 1
       ),
       course_days as (
         select distinct
           al.course_id,
           co.title as course_title,
           co.code  as course_code,
           t.name   as teacher_name,
           td.day_name
         from tt
         join timetable_cells tc on tc.timetable_id = tt.timetable_id
                                 and tc.allocation_id is not null
         join timetable_days td  on td.id = tc.day_id
         join allocations al      on al.id = tc.allocation_id
         join courses co           on co.id = al.course_id
         join teachers t           on t.id  = al.teacher_id
       ),
       att as (
         select attendance_date, status,
                trim(to_char(attendance_date, 'Day')) as dow
         from student_attendance_records
         where student_id = $3 and semester_id = $1
       )
       select
         cd.course_id, cd.course_title, cd.course_code, cd.teacher_name,
         count(case when a.status = 'present' then 1 end)::text as presents,
         count(case when a.status = 'absent'  then 1 end)::text as absents,
         count(case when a.status = 'leave'   then 1 end)::text as leaves
       from course_days cd
       left join att a on a.dow = cd.day_name
       group by cd.course_id, cd.course_title, cd.course_code, cd.teacher_name
       order by cd.course_title`,
      [sem.id, classId, studentId]
    );

    /* overall attendance for this semester */
    const overall = await queryOne<{
      presents: string; absents: string; leaves: string;
    }>(
      `select
         count(case when status = 'present' then 1 end)::text as presents,
         count(case when status = 'absent'  then 1 end)::text as absents,
         count(case when status = 'leave'   then 1 end)::text as leaves
       from student_attendance_records
       where student_id = $1 and semester_id = $2`,
      [studentId, sem.id]
    );

    const toNum = (s: string | undefined) => parseInt(s ?? "0", 10);
    const calcFlag = (p: number, a: number) => {
      const pct = p + a > 0 ? (p / (p + a)) * 100 : 0;
      const flag = pct < 50 ? "struck_off" : pct < 75 ? "warning" : "ok";
      return { percentage: Number(pct.toFixed(2)), flag };
    };

    const courses = courseRows.map((r) => {
      const p = toNum(r.presents), ab = toNum(r.absents), l = toNum(r.leaves);
      return { ...r, presents: p, absents: ab, leaves: l, ...calcFlag(p, ab) };
    });

    const op = toNum(overall?.presents), oa = toNum(overall?.absents), ol = toNum(overall?.leaves);

    result.push({
      semester_id: sem.id,
      semester_number: sem.semester_number,
      term_type: sem.term_type,
      semester_status: sem.status,
      courses,
      overall: { presents: op, absents: oa, leaves: ol, ...calcFlag(op, oa) },
    });
  }

  return NextResponse.json({ semesters: result });
}
