import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  department_id: z.string().uuid(),
  class_id: z.string().uuid(),
  semester_number: z.coerce.number().int().positive(),
  term_type: z.enum(["Fall", "Spring"]),
  start_date: z.string().min(4),
  course_ids: z.array(z.string().uuid()).min(1, "Select at least one course."),
});

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator", "teacher");
  if (response) return response;

  const classId = request.nextUrl.searchParams.get("class_id");
  const departmentId = request.nextUrl.searchParams.get("department_id");
  const status = request.nextUrl.searchParams.get("status");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (classId) { conditions.push(`s.class_id = $${i++}`); values.push(classId); }
  if (departmentId) { conditions.push(`s.department_id = $${i++}`); values.push(departmentId); }
  if (status) { conditions.push(`s.status = $${i++}`); values.push(status); }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const semesters = await query(
    `select s.*, c.class_name, c.session, d.name as department_name,
            coalesce(
              (select json_agg(json_build_object('id', co.id, 'code', co.code, 'title', co.title, 'credit_hours', co.credit_hours, 'outline_url', sc.course_outline_url, 'outline_public_id', sc.course_outline_public_id))
               from semester_courses sc join courses co on co.id = sc.course_id
               where sc.semester_id = s.id),
              '[]'
            ) as courses
     from semesters s
     join classes c on c.id = s.class_id
     join departments d on d.id = s.department_id
     ${where}
     order by s.created_at desc`,
    values
  );
  return NextResponse.json({ semesters });
}

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const activeExisting = await queryOne(
    `select id from semesters where class_id = $1 and status = 'active'`,
    [d.class_id]
  );
  if (activeExisting) {
    return NextResponse.json({ error: "This class already has an active semester. Close it before starting a new one." }, { status: 409 });
  }

  const classRow = await queryOne<{ total_semesters: number }>(
    `select total_semesters from classes where id = $1`,
    [d.class_id]
  );
  if (!classRow) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (d.semester_number > classRow.total_semesters) {
    return NextResponse.json({ error: `This class only has ${classRow.total_semesters} semesters.` }, { status: 400 });
  }

  const uniqueCourseIds = Array.from(new Set(d.course_ids));

  const client = await pool.connect();
  try {
    await client.query("begin");
    const semesterResult = await client.query(
      `insert into semesters (department_id, class_id, semester_number, term_type, start_date, status)
       values ($1, $2, $3, $4, $5, 'active') returning *`,
      [d.department_id, d.class_id, d.semester_number, d.term_type, d.start_date]
    );
    const semester = semesterResult.rows[0];

    for (const courseId of uniqueCourseIds) {
      await client.query(
        `insert into semester_courses (semester_id, course_id) values ($1, $2)`,
        [semester.id, courseId]
      );
    }

    await client.query("commit");
    return NextResponse.json({ semester }, { status: 201 });
  } catch (err) {
    await client.query("rollback");
    console.error("Failed to start semester:", err);
    return NextResponse.json({ error: "Failed to start semester." }, { status: 500 });
  } finally {
    client.release();
  }
}
