import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

type StudentOfMonthRow = {
  student_id: string;
  name: string;
  class_name: string;
  session: string;
  semester_number: number;
  percentage: number;
  profile_image_url: string | null;
};

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const year = Number(request.nextUrl.searchParams.get("year"));
  const month = Number(request.nextUrl.searchParams.get("month"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "A valid year is required." }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Month must be between 1 and 12." }, { status: 400 });
  }

  const students = await query<StudentOfMonthRow>(
    `with monthly_records as (
       select r.student_id, r.semester_id, r.attendance_date, r.status
       from student_attendance_records r
       where r.attendance_date >= make_date($1, $2, 1)
         and r.attendance_date < make_date($1, $2, 1) + interval '1 month'
     ),
     perfect_students as (
       select student_id
       from monthly_records
       group by student_id
       having count(*) filter (where status = 'present') > 0
          and count(*) filter (where status = 'absent') = 0
     ),
     latest_placement as (
       select distinct on (mr.student_id)
              mr.student_id, mr.semester_id
       from monthly_records mr
       join perfect_students ps on ps.student_id = mr.student_id
       order by mr.student_id, mr.attendance_date desc, mr.semester_id
     )
     select st.id as student_id, st.name, c.class_name, c.session,
            sem.semester_number, 100::int as percentage,
            st.profile_image_url
     from perfect_students ps
     join students st on st.id = ps.student_id
     join latest_placement lp on lp.student_id = ps.student_id
     join semesters sem on sem.id = lp.semester_id
     join classes c on c.id = sem.class_id
     where st.deleted_at is null
     order by c.class_name, c.session, sem.semester_number, st.name`,
    [year, month],
  );

  return NextResponse.json({ year, month, students });
}