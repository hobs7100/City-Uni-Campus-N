import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const studentId  = request.nextUrl.searchParams.get("student_id");
  const classId    = request.nextUrl.searchParams.get("class_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const dateFrom   = request.nextUrl.searchParams.get("from");
  const dateTo     = request.nextUrl.searchParams.get("to");

  const departments = await query<{ id: string }>(
    `select id from departments where hod_id = $1`,
    [session!.userId]
  );
  const deptIds = departments.map((d) => d.id);
  if (deptIds.length === 0) return NextResponse.json({ rows: [], semesters: [], classes: [] });

  const classes = await query<{ id: string; class_name: string; session: string }>(
    `select id, class_name, session from classes where department_id = any($1::uuid[]) order by class_name`,
    [deptIds]
  );

  // ── NEW: per-student detailed attendance (course-wise + overall) ──────────
  if (studentId) {
    // Verify the student belongs to this HoD's department
    const stuCheck = await query<{ id: string }>(
      `select s.id from students s where s.id = $1 and s.department_id = any($2::uuid[])`,
      [studentId, deptIds]
    );
    if (stuCheck.length === 0)
      return NextResponse.json({ error: "Student not found." }, { status: 403 });

    // 1) Course-wise attendance per semester (teacher-marked via student_course_attendance)
    const courseRows = await query<{
      semester_id: string;
      semester_number: number;
      term_type: string;
      sem_status: string;
      course_title: string;
      teacher_name: string;
      presents: string;
      absents: string;
      leaves: string;
    }>(
      `select sem.id as semester_id, sem.semester_number, sem.term_type, sem.status as sem_status,
              co.title as course_title, te.name as teacher_name,
              count(*) filter (where sca.status = 'present') as presents,
              count(*) filter (where sca.status = 'absent')  as absents,
              count(*) filter (where sca.status = 'leave')   as leaves
       from students st
       join classes cl on cl.id = st.class_id
       join semesters sem on sem.class_id = cl.id
       join allocation_semesters als on als.semester_id = sem.id
       join allocations a on a.id = als.allocation_id
       join courses co on co.id = a.course_id
       join teachers te on te.id = a.teacher_id
       left join student_course_attendance sca
         on sca.allocation_id = a.id and sca.student_id = $1
       where st.id = $1
       group by sem.id, sem.semester_number, sem.term_type, sem.status, co.title, te.name
       order by sem.semester_number, co.title`,
      [studentId]
    );

    // 2) Overall attendance per semester (admin/coordinator-marked via student_attendance_records)
    const overallRows = await query<{
      semester_id: string;
      presents: string;
      absents: string;
      leaves: string;
    }>(
      `select sem.id as semester_id,
              count(*) filter (where sar.status = 'present') as presents,
              count(*) filter (where sar.status = 'absent')  as absents,
              count(*) filter (where sar.status = 'leave')   as leaves
       from students st
       join classes cl on cl.id = st.class_id
       join semesters sem on sem.class_id = cl.id
       left join student_attendance_records sar
         on sar.semester_id = sem.id and sar.student_id = $1
       where st.id = $1
       group by sem.id`,
      [studentId]
    );

    // Build overall map
    const overallMap = new Map<string, { presents: number; absents: number; leaves: number; percentage: number | null }>();
    for (const r of overallRows) {
      const p = Number(r.presents), a = Number(r.absents), l = Number(r.leaves);
      const total = p + a;
      overallMap.set(r.semester_id, { presents: p, absents: a, leaves: l, percentage: total > 0 ? Math.round((p / total) * 100) : null });
    }

    // Group course rows by semester
    const semMap = new Map<string, {
      semester_id: string; semester_number: number; term_type: string; sem_status: string;
      courses: { course_title: string; teacher_name: string; presents: number; absents: number; leaves: number; percentage: number | null }[];
    }>();
    for (const r of courseRows) {
      if (!semMap.has(r.semester_id)) {
        semMap.set(r.semester_id, {
          semester_id: r.semester_id,
          semester_number: Number(r.semester_number),
          term_type: r.term_type,
          sem_status: r.sem_status,
          courses: [],
        });
      }
      const p = Number(r.presents), a = Number(r.absents), l = Number(r.leaves);
      const total = p + a;
      semMap.get(r.semester_id)!.courses.push({
        course_title: r.course_title,
        teacher_name: r.teacher_name,
        presents: p, absents: a, leaves: l,
        percentage: total > 0 ? Math.round((p / total) * 100) : null,
      });
    }

    // Attach overall to each semester entry (even if no course rows exist for a semester with only overall records)
    // Also ensure semesters with only overall records appear
    const allSemIds = new Set([...semMap.keys(), ...overallMap.keys()]);
    const semesters = Array.from(allSemIds).map((sid) => {
      const entry = semMap.get(sid) ?? { semester_id: sid, semester_number: 0, term_type: "", sem_status: "", courses: [] };
      const overall = overallMap.get(sid) ?? { presents: 0, absents: 0, leaves: 0, percentage: null };
      return { ...entry, overall };
    }).sort((a, b) => a.semester_number - b.semester_number);

    return NextResponse.json({ semesters });
  }

  // ── Existing class-level behaviour (unchanged) ───────────────────────────
  if (!classId) {
    return NextResponse.json({ rows: [], semesters: [], classes });
  }

  const classValid = classes.find((c) => c.id === classId);
  if (!classValid) return NextResponse.json({ error: "Class not found." }, { status: 403 });

  const semesters = await query<{ id: string; semester_number: number; term_type: string; status: string }>(
    `select id, semester_number, term_type, status from semesters where class_id = $1 order by semester_number desc`,
    [classId]
  );

  if (!semesterId) {
    return NextResponse.json({ rows: [], semesters, classes });
  }

  const sem = semesters.find((s) => s.id === semesterId);
  if (!sem) return NextResponse.json({ error: "Semester not found." }, { status: 404 });

  const dateConditions: string[] = [];
  const extraValues: unknown[] = [classId, semesterId];
  let idx = 3;
  if (dateFrom) { dateConditions.push(`sar.attendance_date >= $${idx++}`); extraValues.push(dateFrom); }
  if (dateTo)   { dateConditions.push(`sar.attendance_date <= $${idx++}`); extraValues.push(dateTo); }
  const dateWhere = dateConditions.length > 0 ? `and ${dateConditions.join(" and ")}` : "";

  const rows = await query<{
    student_id: string; name: string; roll_no: string | null;
    presents: string; absents: string; leaves: string;
  }>(
    `select st.id as student_id, st.name, st.roll_no,
            count(*) filter (where sar.status = 'present' ${dateWhere}) as presents,
            count(*) filter (where sar.status = 'absent'  ${dateWhere}) as absents,
            count(*) filter (where sar.status = 'leave'   ${dateWhere}) as leaves
     from students st
     left join student_attendance_records sar
       on sar.student_id = st.id and sar.semester_id = $2
     where st.class_id = $1 and st.deleted_at is null
     group by st.id, st.name, st.roll_no
     order by (st.roll_no is null), st.roll_no, st.name`,
    extraValues
  );

  const report = rows.map((r) => {
    const p = Number(r.presents), a = Number(r.absents), l = Number(r.leaves);
    const total = p + a;
    const pct = total > 0 ? Math.round((p / total) * 100) : null;
    return {
      student_id: r.student_id, name: r.name, roll_no: r.roll_no,
      presents: p, absents: a, leaves: l, percentage: pct,
      status: pct === null ? "no-data" : pct >= 75 ? "ok" : pct >= 50 ? "warning" : "struck-off",
    };
  });

  return NextResponse.json({ rows: report, semesters, classes });
}
