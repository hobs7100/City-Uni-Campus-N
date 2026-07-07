import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const classId = request.nextUrl.searchParams.get("class_id");
  if (!classId) return NextResponse.json({ error: "class_id is required." }, { status: 400 });

  const allocationId = request.nextUrl.searchParams.get("allocation_id");

  const semester = await query<{ id: string; semester_number: number; term_type: string }>(
    `select s.id, s.semester_number, s.term_type
     from semesters s
     where s.class_id = $1 and s.status = 'active'
     limit 1`,
    [classId]
  );
  if (semester.length === 0) {
    return NextResponse.json({ error: "No active semester for this class." }, { status: 404 });
  }
  const sem = semester[0];

  const allocationCheck = await query<{ id: string }>(
    `select a.id from allocations a
     join allocation_semesters als on als.allocation_id = a.id
     where a.teacher_id = $1 and als.semester_id = $2
     ${allocationId ? "and a.id = $3" : ""}
     limit 1`,
    allocationId ? [session!.userId, sem.id, allocationId] : [session!.userId, sem.id]
  );
  if (allocationCheck.length === 0) {
    return NextResponse.json({ error: "You are not allocated to this class." }, { status: 403 });
  }

  const rows = await query<{
    student_id: string;
    name: string;
    roll_no: string | null;
    presents: string;
    absents: string;
    leaves: string;
  }>(
    `select st.id as student_id, st.name, st.roll_no,
            count(*) filter (where sar.status = 'present') as presents,
            count(*) filter (where sar.status = 'absent') as absents,
            count(*) filter (where sar.status = 'leave') as leaves
     from students st
     left join student_attendance_records sar
       on sar.student_id = st.id and sar.semester_id = $2
     where st.class_id = $1 and st.deleted_at is null and st.status = 'active'
     group by st.id, st.name, st.roll_no
     order by (st.roll_no is null), st.roll_no, st.name`,
    [classId, sem.id]
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

  return NextResponse.json({ semester: sem, rows: report });
}
