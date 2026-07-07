import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const allocationId = request.nextUrl.searchParams.get("allocation_id");
  if (!allocationId) {
    return NextResponse.json({ error: "allocation_id is required." }, { status: 400 });
  }

  const allocation = await queryOne<{ id: string; is_combined: boolean; course_title: string }>(
    `select a.id, a.is_combined, co.title as course_title
     from allocations a
     join courses co on co.id = a.course_id
     where a.id = $1 and a.teacher_id = $2 and a.deleted_at is null`,
    [allocationId, session!.userId]
  );
  if (!allocation) {
    return NextResponse.json({ error: "Allocation not found or not yours." }, { status: 403 });
  }

  const classIds = await query<{ class_id: string; class_name: string; session: string }>(
    `select distinct s.class_id, cl.class_name, cl.session
     from allocation_semesters als
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     where als.allocation_id = $1`,
    [allocationId]
  );

  if (classIds.length === 0) {
    return NextResponse.json({ rows: [], allocation });
  }

  const allClassIds = classIds.map((r) => r.class_id);

  const rows = await query<{
    student_id: string;
    name: string;
    roll_no: string | null;
    class_name: string;
    session: string;
    presents: string;
    absents: string;
    leaves: string;
  }>(
    `select st.id as student_id, st.name, st.roll_no,
            cl.class_name, cl.session,
            count(*) filter (where sca.status = 'present') as presents,
            count(*) filter (where sca.status = 'absent')  as absents,
            count(*) filter (where sca.status = 'leave')   as leaves
     from students st
     join classes cl on cl.id = st.class_id
     left join student_course_attendance sca
       on sca.student_id = st.id and sca.allocation_id = $1
     where st.class_id = any($2::uuid[])
       and st.deleted_at is null
       and st.status = 'active'
     group by st.id, st.name, st.roll_no, cl.class_name, cl.session
     order by cl.class_name, (st.roll_no is null), st.roll_no, st.name`,
    [allocationId, allClassIds]
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
      class_name: r.class_name,
      session: r.session,
      presents: p,
      absents: a,
      leaves: l,
      percentage: pct,
      status: pct === null ? "no-data" : pct >= 75 ? "ok" : pct >= 50 ? "warning" : "low",
    };
  });

  return NextResponse.json({ rows: report, allocation });
}
