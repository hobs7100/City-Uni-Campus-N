import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const classId = request.nextUrl.searchParams.get("class_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const dateFrom = request.nextUrl.searchParams.get("from");
  const dateTo = request.nextUrl.searchParams.get("to");

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
  if (dateTo) { dateConditions.push(`sar.attendance_date <= $${idx++}`); extraValues.push(dateTo); }
  const dateWhere = dateConditions.length > 0 ? `and ${dateConditions.join(" and ")}` : "";

  const rows = await query<{
    student_id: string;
    name: string;
    roll_no: string | null;
    presents: string;
    absents: string;
    leaves: string;
  }>(
    `select st.id as student_id, st.name, st.roll_no,
            count(*) filter (where sar.status = 'present' ${dateWhere}) as presents,
            count(*) filter (where sar.status = 'absent' ${dateWhere}) as absents,
            count(*) filter (where sar.status = 'leave' ${dateWhere}) as leaves
     from students st
     left join student_attendance_records sar
       on sar.student_id = st.id and sar.semester_id = $2
     where st.class_id = $1 and st.deleted_at is null
     group by st.id, st.name, st.roll_no
     order by (st.roll_no is null), st.roll_no, st.name`,
    extraValues
  );

  const report = rows.map((r) => {
    const p = Number(r.presents);
    const a = Number(r.absents);
    const l = Number(r.leaves);
    const total = p + a;
    const pct = total > 0 ? Math.round((p / total) * 100) : null;
    return {
      student_id: r.student_id,
      name: r.name,
      roll_no: r.roll_no,
      presents: p,
      absents: a,
      leaves: l,
      percentage: pct,
      status: pct === null ? "no-data" : pct >= 75 ? "ok" : pct >= 50 ? "warning" : "struck-off",
    };
  });

  return NextResponse.json({ rows: report, semesters, classes });
}
