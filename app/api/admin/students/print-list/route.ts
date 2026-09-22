import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const querySchema = z.object({
  department_id: z.string().uuid(),
  class_id: z.string().uuid(),
  semester_id: z.string().uuid(),
  course_id: z.string().uuid(),
});

interface ReportMeta {
  department_name: string;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
  course_code: string;
  course_title: string;
}

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Department, class, semester, and subject are required." },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const meta = await queryOne<ReportMeta>(
    `select dep.name as department_name,
            cl.class_name,
            cl.session,
            sem.semester_number,
            sem.term_type,
            co.code as course_code,
            co.title as course_title
     from semesters sem
     join classes cl on cl.id = sem.class_id
     join departments dep on dep.id = sem.department_id
     join semester_courses sc on sc.semester_id = sem.id
     join courses co on co.id = sc.course_id
     where dep.id = $1
       and cl.id = $2
       and sem.id = $3
       and co.id = $4
       and cl.department_id = dep.id
       and sem.class_id = cl.id
       and sem.department_id = dep.id
     limit 1`,
    [d.department_id, d.class_id, d.semester_id, d.course_id],
  );

  if (!meta) {
    return NextResponse.json(
      { error: "The selected department, class, semester, and subject do not match." },
      { status: 404 },
    );
  }

  const students = await query<{
    id: string;
    roll_no: string | null;
    name: string;
    father_name: string | null;
  }>(
    `select s.id, s.roll_no, s.name, s.father_name
     from students s
     where s.department_id = $1
       and s.class_id = $2
       and s.status = 'active'
       and s.deleted_at is null
     order by s.roll_no asc nulls last, s.name asc`,
    [d.department_id, d.class_id],
  );

  return NextResponse.json({ meta, students });
}