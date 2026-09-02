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
    /* Course-wise counts use the teacher-marked source directly. This keeps the
       student portal aligned with teacher and HoD reports instead of inferring
       course attendance from class-level records and timetable weekdays. */
    const courseRows = await query<{
      course_id: string; course_title: string; course_code: string;
      teacher_name: string; presents: string; absents: string; leaves: string;
    }>(
      `select
         al.course_id,
         co.title as course_title,
         co.code  as course_code,
         t.name   as teacher_name,
         count(*) filter (where sca.status = 'present')::text as presents,
         count(*) filter (where sca.status = 'absent')::text  as absents,
         count(*) filter (where sca.status = 'leave')::text   as leaves
       from allocation_semesters als
       join allocations al on al.id = als.allocation_id
       join courses co on co.id = al.course_id
       join teachers t on t.id = al.teacher_id
       left join student_course_attendance sca
         on sca.allocation_id = al.id and sca.student_id = $2
       where als.semester_id = $1
       group by al.id, al.course_id, co.title, co.code, t.id, t.name
       order by co.title`,
      [sem.id, studentId]
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
      const flag = pct < 60 ? "struck_off" : pct < 75 ? "warning" : "ok";
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
