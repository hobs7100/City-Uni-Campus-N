import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { session, response } = await requireRole("admin", "hod");
  if (response) return response;
  if (session!.role === "assistant") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { studentId } = await params;
  const student = await queryOne<{
    id: string;
    name: string;
    father_name: string | null;
    roll_no: string | null;
    class_id: string;
    class_name: string;
    session: string;
    department_name: string;
    profile_image_url: string | null;
  }>(
    `select st.id, st.name, st.father_name, st.roll_no, st.class_id,
            cl.class_name, st.session, d.name as department_name,
            st.profile_image_url
     from students st
     join classes cl on cl.id = st.class_id
     join departments d on d.id = st.department_id
     where st.id = $1 and st.deleted_at is null`,
    [studentId],
  );
  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const semester = await queryOne<{
    id: string;
    semester_number: number;
    term_type: string;
  }>(
    `select id, semester_number, term_type
     from semesters where class_id = $1 and status = 'active'`,
    [student.class_id],
  );
  if (!semester) {
    return NextResponse.json({ error: "No active semester found." }, { status: 404 });
  }

  const datesheetRows = await query<{
    course_id: string;
    course_title: string;
    course_code: string;
    credit_hours: string;
    paper_date: string | null;
  }>(
    `select distinct on (sc.course_id)
       sc.course_id, c.title as course_title, c.code as course_code,
       c.credit_hours::text as credit_hours,
       to_char(med.paper_date, 'YYYY-MM-DD') as paper_date
     from semester_courses sc
     join courses c on c.id = sc.course_id
     left join mid_exam_datesheets med
       on med.semester_id = sc.semester_id and med.course_id = sc.course_id
     where sc.semester_id = $1
     order by sc.course_id, c.title`,
    [semester.id],
  );
  const datedRows = datesheetRows.filter((row) => row.paper_date !== null);
  if (datedRows.length === 0) {
    return NextResponse.json({ error: "No Mid Exam Date Sheet is available." }, { status: 404 });
  }

  const overall = await queryOne<{ presents: string; absents: string }>(
    `select
       count(*) filter (where status = 'present')::text as presents,
       count(*) filter (where status = 'absent')::text as absents
     from student_attendance_records
     where student_id = $1 and semester_id = $2`,
    [studentId, semester.id],
  );
  const presents = Number(overall?.presents ?? 0);
  const absents = Number(overall?.absents ?? 0);
  const overallAttendance =
    presents + absents > 0 ? (presents / (presents + absents)) * 100 : 0;

  const courseAttendance = await query<{
    course_id: string;
    presents: string;
    absents: string;
  }>(
    `select a.course_id,
       count(*) filter (where sca.status = 'present')::text as presents,
       count(*) filter (where sca.status = 'absent')::text as absents
     from student_course_attendance sca
     join allocations a on a.id = sca.allocation_id
     join allocation_semesters als
       on als.allocation_id = a.id and als.semester_id = $1
     where sca.student_id = $2
     group by a.course_id`,
    [semester.id, studentId],
  );
  const attendanceMap = new Map(
    courseAttendance.map((row) => {
      const coursePresents = Number(row.presents);
      const courseAbsents = Number(row.absents);
      return [
        row.course_id,
        coursePresents + courseAbsents > 0
          ? (coursePresents / (coursePresents + courseAbsents)) * 100
          : 100,
      ];
    }),
  );

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      father_name: student.father_name,
      roll_no: student.roll_no,
      class_name: student.class_name,
      session: student.session,
      department: student.department_name,
      profile_image_url: student.profile_image_url,
    },
    semester,
    overall_attendance: Number(overallAttendance.toFixed(2)),
    rows: datedRows.map((row) => ({
      ...row,
      att_percentage: Number((attendanceMap.get(row.course_id) ?? 100).toFixed(2)),
    })),
  });
}