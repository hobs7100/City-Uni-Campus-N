import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const studentId = session!.userId;

  // ── 1. Student profile ──────────────────────────────────────────────────────
  const student = await queryOne<{
    id: string; name: string; father_name: string | null;
    class_id: string; class_name: string; session: string;
    status: string; department_name: string; profile_image_url: string | null;
  }>(
    `select st.id, st.name, st.father_name, st.class_id, cl.class_name,
            st.session, st.status, d.name as department_name,
            st.profile_image_url
     from students st
     join classes cl on cl.id = st.class_id
     join departments d on d.id = st.department_id
     where st.id = $1 and st.deleted_at is null`,
    [studentId]
  );

  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  // ── Validation 1: active student ────────────────────────────────────────────
  if (student.status !== "active") {
    return NextResponse.json({
      allowed: false,
      reason: "inactive_student",
      message: `Your enrollment status is "${student.status}". Only active students are permitted to generate a Roll Number Slip.`,
    });
  }

  // ── 2. Active semester ──────────────────────────────────────────────────────
  const semester = await queryOne<{
    id: string; semester_number: number; term_type: string;
  }>(
    `select id, semester_number, term_type
     from semesters where class_id = $1 and status = 'active'`,
    [student.class_id]
  );

  if (!semester) {
    return NextResponse.json({
      allowed: false,
      reason: "no_active_semester",
      message: "There is no active semester for your class at this time. Please check back later.",
    });
  }

  // ── Validation 2: datesheet must exist ─────────────────────────────────────
  const datesheetRows = await query<{
    course_id: string; course_title: string; course_code: string;
    credit_hours: string; paper_date: string | null;
  }>(
    `select distinct on (sc.course_id)
       sc.course_id,
       c.title              as course_title,
       c.code               as course_code,
       c.credit_hours::text as credit_hours,
       to_char(med.paper_date, 'YYYY-MM-DD') as paper_date
     from semester_courses sc
     join courses c on c.id = sc.course_id
     left join mid_exam_datesheets med
       on med.semester_id = sc.semester_id and med.course_id = sc.course_id
     where sc.semester_id = $1
     order by sc.course_id, c.title`,
    [semester.id]
  );

  const datesheetExists = datesheetRows.some((r) => r.paper_date !== null);

  if (!datesheetExists) {
    return NextResponse.json({
      allowed: false,
      reason: "no_datesheet",
      message: "The Mid Exam Date Sheet for the current semester has not been published yet. Please check back once the Admin has created the date sheet.",
    });
  }

  // ── Validation 3: overall attendance ≥ 75 % ─────────────────────────────────
  const overallAtt = await queryOne<{ presents: string; absents: string }>(
    `select
       count(case when status = 'present' then 1 end)::text as presents,
       count(case when status = 'absent'  then 1 end)::text as absents
     from student_attendance_records
     where student_id = $1 and semester_id = $2`,
    [studentId, semester.id]
  );

  const p = parseInt(overallAtt?.presents ?? "0", 10);
  const a = parseInt(overallAtt?.absents ?? "0", 10);
  const overallPct = p + a > 0 ? (p / (p + a)) * 100 : 0;

  if (overallPct < 75) {
    return NextResponse.json({
      allowed: false,
      reason: "low_attendance",
      message: `Your overall attendance is ${overallPct.toFixed(1)}%, which is below the required 75 %. You are not eligible to sit the Mid Term Examination.`,
    });
  }

  // ── Per-course attendance (same day-of-week query as course-attendance API) ─
  const courseAttRows = await query<{
    course_id: string; presents: string; absents: string;
  }>(
    `with tt as (
       select id as timetable_id
       from timetables
       where class_id = $2 and semester_id = $1
       limit 1
     ),
     course_days as (
       select distinct al.course_id, td.day_name
       from tt
       join timetable_cells tc on tc.timetable_id = tt.timetable_id
                               and tc.allocation_id is not null
       join timetable_days td  on td.id = tc.day_id
       join allocations al     on al.id = tc.allocation_id
     ),
     att as (
       select status, trim(to_char(attendance_date, 'Day')) as dow
       from student_attendance_records
       where student_id = $3 and semester_id = $1
     )
     select
       cd.course_id,
       count(case when a.status = 'present' then 1 end)::text as presents,
       count(case when a.status = 'absent'  then 1 end)::text as absents
     from course_days cd
     left join att a on a.dow = cd.day_name
     group by cd.course_id`,
    [semester.id, student.class_id, studentId]
  );

  const attMap = new Map<string, number>();
  for (const r of courseAttRows) {
    const cp = parseInt(r.presents, 10);
    const ca = parseInt(r.absents, 10);
    attMap.set(r.course_id, cp + ca > 0 ? (cp / (cp + ca)) * 100 : 100);
  }

  const rows = datesheetRows
    .filter((r) => r.paper_date !== null)
    .map((r) => ({
      ...r,
      att_percentage: parseFloat((attMap.get(r.course_id) ?? 100).toFixed(2)),
    }));

  return NextResponse.json({
    allowed: true,
    student: {
      id: student.id,
      name: student.name,
      father_name: student.father_name,
      class_name: student.class_name,
      session: student.session,
      department: student.department_name,
      profile_image_url: student.profile_image_url ?? null,
    },
    semester: {
      id: semester.id,
      semester_number: semester.semester_number,
      term_type: semester.term_type,
    },
    overall_attendance: parseFloat(overallPct.toFixed(2)),
    rows,
  });
}
