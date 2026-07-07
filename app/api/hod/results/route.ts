import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ students: [] });

  const departments = await query<{ id: string }>(
    `select id from departments where hod_id = $1`,
    [session!.userId]
  );
  const deptIds = departments.map((d) => d.id);
  if (deptIds.length === 0) return NextResponse.json({ students: [] });

  const students = await query<{
    id: string;
    name: string;
    roll_no: string | null;
    class_name: string;
    session: string;
    department_name: string;
  }>(
    `select s.id, s.name, s.roll_no, c.class_name, s.session, d.name as department_name
     from students s
     join classes c on c.id = s.class_id
     join departments d on d.id = s.department_id
     where s.department_id = any($1::uuid[])
       and s.deleted_at is null
       and (lower(s.name) like lower($2) or lower(s.roll_no::text) like lower($2))
     order by s.name
     limit 20`,
    [deptIds, `%${q}%`]
  );

  return NextResponse.json({ students });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const studentId = body?.student_id;
  if (!studentId) return NextResponse.json({ error: "student_id required." }, { status: 400 });

  const departments = await query<{ id: string }>(
    `select id from departments where hod_id = $1`,
    [session!.userId]
  );
  const deptIds = departments.map((d) => d.id);

  const student = await query<{
    id: string;
    name: string;
    roll_no: string | null;
    session: string;
    class_name: string;
    department_name: string;
    university_name: string | null;
  }>(
    `select s.id, s.name, s.roll_no, s.session, c.class_name, d.name as department_name, a.university_name
     from students s
     join classes c on c.id = s.class_id
     join departments d on d.id = s.department_id
     left join affiliations a on a.id = c.affiliation_id
     where s.id = $1 and s.department_id = any($2::uuid[])`,
    [studentId, deptIds]
  );
  if (student.length === 0) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const rows = await query(
    `select r.*, co.code as course_code, co.title as course_title, co.credit_hours,
            sem.semester_number, sem.term_type
     from results r
     join courses co on co.id = r.course_id
     join semesters sem on sem.id = r.semester_id
     where r.student_id = $1
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

  return NextResponse.json({ student: student[0], semesters: Array.from(bySemester.values()) });
}
