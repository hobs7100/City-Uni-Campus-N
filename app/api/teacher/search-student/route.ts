import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const teacherId = session!.userId;
  const studentId = request.nextUrl.searchParams.get("student_id");

  // Classes where this teacher has active-semester allocations
  const activeClasses = await query<{ class_id: string }>(
    `select distinct c.id as class_id
     from classes c
     join semesters sem on sem.class_id = c.id and sem.status = 'active'
     join allocation_semesters als on als.semester_id = sem.id
     join allocations a on a.id = als.allocation_id and a.teacher_id = $1
     where a.deleted_at is null`,
    [teacherId]
  );
  const classIds = activeClasses.map((r) => r.class_id);

  if (classIds.length === 0) {
    if (studentId)
      return NextResponse.json(
        { error: "No active allocations found." },
        { status: 403 }
      );
    return NextResponse.json({ students: [] });
  }

  // ── Student list mode ────────────────────────────────────────────────────
  if (!studentId) {
    const students = await query<{
      id: string;
      name: string;
      roll_no: string | null;
      class_name: string;
      session: string;
    }>(
      `select s.id, s.name, s.roll_no, c.class_name, s.session
       from students s
       join classes c on c.id = s.class_id
       where s.class_id = any($1::uuid[]) and s.deleted_at is null
       order by c.class_name, s.name`,
      [classIds]
    );
    return NextResponse.json({ students });
  }

  // ── Per-student attendance mode (active semester only) ───────────────────
  const stuCheck = await query<{ id: string }>(
    `select s.id from students s
     where s.id = $1 and s.class_id = any($2::uuid[]) and s.deleted_at is null`,
    [studentId, classIds]
  );
  if (stuCheck.length === 0)
    return NextResponse.json(
      { error: "Student not found in your active classes." },
      { status: 403 }
    );

  // Active semester for this student's class
  const semRows = await query<{
    semester_id: string;
    semester_number: number;
    term_type: string;
  }>(
    `select sem.id as semester_id, sem.semester_number, sem.term_type
     from semesters sem
     join students s on s.class_id = sem.class_id
     where s.id = $1 and sem.status = 'active'
     limit 1`,
    [studentId]
  );

  if (semRows.length === 0) return NextResponse.json({ semesters: [] });
  const sem = semRows[0];

  // Course-wise attendance (teacher-marked via student_course_attendance)
  const courseRows = await query<{
    course_title: string;
    teacher_name: string;
    presents: string;
    absents: string;
    leaves: string;
  }>(
    `select co.title as course_title, te.name as teacher_name,
            count(*) filter (where sca.status = 'present') as presents,
            count(*) filter (where sca.status = 'absent')  as absents,
            count(*) filter (where sca.status = 'leave')   as leaves
     from allocation_semesters als
     join allocations a on a.id = als.allocation_id
     join courses co on co.id = a.course_id
     join teachers te on te.id = a.teacher_id
     left join student_course_attendance sca
       on sca.allocation_id = a.id and sca.student_id = $1
     where als.semester_id = $2 and a.deleted_at is null
     group by co.title, te.name
     order by co.title`,
    [studentId, sem.semester_id]
  );

  // Overall attendance (admin/coordinator-marked via student_attendance_records)
  const ovRows = await query<{
    presents: string;
    absents: string;
    leaves: string;
  }>(
    `select
       count(*) filter (where sar.status = 'present') as presents,
       count(*) filter (where sar.status = 'absent')  as absents,
       count(*) filter (where sar.status = 'leave')   as leaves
     from student_attendance_records sar
     where sar.student_id = $1 and sar.semester_id = $2`,
    [studentId, sem.semester_id]
  );

  const ov = ovRows[0] ?? { presents: "0", absents: "0", leaves: "0" };
  const ovP = Number(ov.presents),
    ovA = Number(ov.absents),
    ovL = Number(ov.leaves);

  const courses = courseRows.map((r) => {
    const p = Number(r.presents),
      a = Number(r.absents),
      l = Number(r.leaves);
    const total = p + a;
    return {
      course_title: r.course_title,
      teacher_name: r.teacher_name,
      presents: p,
      absents: a,
      leaves: l,
      percentage: total > 0 ? Math.round((p / total) * 100) : null,
    };
  });

  return NextResponse.json({
    semesters: [
      {
        semester_id: sem.semester_id,
        semester_number: sem.semester_number,
        term_type: sem.term_type,
        sem_status: "active",
        courses,
        overall: {
          presents: ovP,
          absents: ovA,
          leaves: ovL,
          percentage:
            ovP + ovA > 0 ? Math.round((ovP / (ovP + ovA)) * 100) : null,
        },
      },
    ],
  });
}
