/**
 * GET /api/admin/dept-attendance-details
 * Returns per-student coordinator-marked attendance for a given class + semester.
 * Accessible by admin and hod roles.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod");
  if (response) return response;

  const classId    = request.nextUrl.searchParams.get("class_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");

  if (!classId || !semesterId) {
    return NextResponse.json(
      { error: "class_id and semester_id are required." },
      { status: 400 }
    );
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
            count(*) filter (where sar.status = 'absent')  as absents,
            count(*) filter (where sar.status = 'leave')   as leaves
     from students st
     left join student_attendance_records sar
       on sar.student_id = st.id and sar.semester_id = $2
     where st.class_id = $1 and st.deleted_at is null
     group by st.id, st.name, st.roll_no
     order by (st.roll_no is null), st.roll_no, st.name`,
    [classId, semesterId]
  );

  const students = rows.map((r) => {
    const p = Number(r.presents);
    const a = Number(r.absents);
    const l = Number(r.leaves);
    const total = p + a;
    return {
      student_id: r.student_id,
      name:       r.name,
      roll_no:    r.roll_no,
      presents:   p,
      absents:    a,
      leaves:     l,
      percentage: total > 0 ? Math.round((p / total) * 100) : null,
    };
  });

  return NextResponse.json({ students });
}
