import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const studentId = request.nextUrl.searchParams.get("student_id");
  if (!studentId) return NextResponse.json({ error: "student_id is required." }, { status: 400 });

  const student = await queryOne(
    `select s.id, s.name, s.roll_no, s.session, c.class_name, d.name as department_name, a.university_name
     from students s
     join classes c on c.id = s.class_id
     join departments d on d.id = s.department_id
     left join affiliations a on a.id = c.affiliation_id
     where s.id = $1`,
    [studentId]
  );
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  // Exclude lab courses: credit_hours = 1 OR code contains 'Lab'
  const rows = await query(
    `select r.*, co.code as course_code, co.title as course_title, co.credit_hours,
            sem.semester_number, sem.term_type
     from results r
     join courses co on co.id = r.course_id
     join semesters sem on sem.id = r.semester_id
     where r.student_id = $1
       and NOT (co.credit_hours::numeric = 1 OR co.code ILIKE '%Lab%')
     order by sem.semester_number, co.code`,
    [studentId]
  );

  const bySemester = new Map<number, { semester_number: number; term_type: string; courses: Record<string, unknown>[] }>();
  for (const r of rows as Record<string, unknown>[]) {
    const semNum = r.semester_number as number;
    if (!bySemester.has(semNum)) {
      bySemester.set(semNum, { semester_number: semNum, term_type: r.term_type as string, courses: [] });
    }
    bySemester.get(semNum)!.courses.push(r);
  }

  return NextResponse.json({ student, semesters: Array.from(bySemester.values()) });
}
