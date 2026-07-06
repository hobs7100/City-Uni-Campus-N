import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const classId = request.nextUrl.searchParams.get("class_id");

  const conditions: string[] = ["r.status = 'freezed'", "s.deleted_at is null"];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`s.department_id = $${i++}`); values.push(departmentId); }
  if (classId) { conditions.push(`s.class_id = $${i++}`); values.push(classId); }
  const where = `where ${conditions.join(" and ")}`;

  const rows = await query(
    `select distinct on (s.id, r.semester_id)
            s.id as student_id, s.name as student_name, s.roll_no, d.name as department_name,
            a.university_name, c.class_name, s.session,
            sem.semester_number, sem.term_type, r.updated_at
     from results r
     join students s on s.id = r.student_id
     join departments d on d.id = s.department_id
     join classes c on c.id = s.class_id
     left join affiliations a on a.id = c.affiliation_id
     join semesters sem on sem.id = r.semester_id
     ${where}
     order by s.id, r.semester_id, r.updated_at desc`,
    values
  );

  return NextResponse.json({ students: rows });
}
