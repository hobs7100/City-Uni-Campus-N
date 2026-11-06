import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireExactRole } from "@/lib/requireRole";
import { buildStudentCountSummary, type StudentCountRow } from "@/lib/student-count-summary";

export async function GET() {
  const { response } = await requireExactRole("admin");
  if (response) return response;

  try {
    const rows = await query<StudentCountRow>(
      `select d.id as department_id, d.name as department_name,
              c.id as class_id, c.class_name, c.session,
              semester.semester_number as active_semester_number,
              count(s.id)::int as total_students
       from classes c
       join departments d on d.id = c.department_id
       left join lateral (
         select semester_number from semesters
         where class_id = c.id and status = 'active'
         order by created_at desc, id
         limit 1
       ) semester on true
       left join students s on s.class_id = c.id
         and s.deleted_at is null and s.status in ('active', 'struck_off')
       where c.status = 'active'
       group by d.id, d.name, c.id, c.class_name, c.session, semester.semester_number
       order by d.name, d.id, c.class_name, c.session, c.id`,
    );
    return NextResponse.json(buildStudentCountSummary(rows), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Student count summary failed:", error);
    return NextResponse.json({ error: "Unable to load the student count summary." }, { status: 500 });
  }
}
