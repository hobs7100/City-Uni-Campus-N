import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const session = request.nextUrl.searchParams.get("session");
  const classId = request.nextUrl.searchParams.get("class_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");

  const conditions: string[] = ["r.status = 'fail'", "s.deleted_at is null"];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`s.department_id = $${i++}`); values.push(departmentId); }
  if (session) { conditions.push(`s.session = $${i++}`); values.push(session); }
  if (classId) { conditions.push(`s.class_id = $${i++}`); values.push(classId); }
  if (semesterId) { conditions.push(`r.semester_id = $${i++}`); values.push(semesterId); }
  const where = `where ${conditions.join(" and ")}`;

  const rows = await query(
    `select s.id as student_id, s.name as student_name, s.roll_no, d.name as department_name,
            a.university_name, c.class_name, s.session,
            co.title as course_title, co.code as course_code, sem.semester_number, sem.term_type
     from results r
     join students s on s.id = r.student_id
     join departments d on d.id = s.department_id
     join classes c on c.id = s.class_id
     left join affiliations a on a.id = c.affiliation_id
     join courses co on co.id = r.course_id
     join semesters sem on sem.id = r.semester_id
     ${where}
     order by s.name`,
    values
  );

  const byStudent = new Map<string, {
    student_id: string; student_name: string; roll_no: string | null;
    department_name: string; university_name: string | null; class_name: string; session: string;
    failed_courses: { course_title: string; course_code: string; semester_number: number; term_type: string }[];
  }>();

  for (const r of rows as Record<string, unknown>[]) {
    const key = String(r.student_id);
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        student_id: key,
        student_name: r.student_name as string,
        roll_no: r.roll_no as string | null,
        department_name: r.department_name as string,
        university_name: r.university_name as string | null,
        class_name: r.class_name as string,
        session: r.session as string,
        failed_courses: [],
      });
    }
    byStudent.get(key)!.failed_courses.push({
      course_title: r.course_title as string,
      course_code: r.course_code as string,
      semester_number: r.semester_number as number,
      term_type: r.term_type as string,
    });
  }

  return NextResponse.json({ students: Array.from(byStudent.values()) });
}
