import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  course_id: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const semester = await queryOne<{ id: string; status: string; department_id: string }>(
    `select id, status, department_id from semesters where id = $1`,
    [id]
  );
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });
  if (semester.status === "closed") {
    return NextResponse.json({ error: "Cannot edit courses on a closed semester." }, { status: 409 });
  }

  const course = await queryOne<{ id: string; department_id: string }>(
    `select id, department_id from courses where id = $1`,
    [d.course_id]
  );
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  if (course.department_id !== semester.department_id) {
    return NextResponse.json({ error: "This course does not belong to the semester's department." }, { status: 400 });
  }

  const existing = await queryOne(
    `select 1 from semester_courses where semester_id = $1 and course_id = $2`,
    [id, d.course_id]
  );
  if (existing) {
    return NextResponse.json({ error: "This course is already part of the semester's curriculum." }, { status: 409 });
  }

  await queryOne(
    `insert into semester_courses (semester_id, course_id) values ($1, $2) returning id`,
    [id, d.course_id]
  );
  return NextResponse.json({ success: true }, { status: 201 });
}
