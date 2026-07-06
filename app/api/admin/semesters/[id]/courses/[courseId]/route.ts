import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; courseId: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id, courseId } = await params;

  const semester = await queryOne<{ id: string; status: string }>(`select id, status from semesters where id = $1`, [id]);
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });
  if (semester.status === "closed") {
    return NextResponse.json({ error: "Cannot edit courses on a closed semester." }, { status: 409 });
  }

  const inCatalog = await queryOne(
    `select 1 from semester_courses where semester_id = $1 and course_id = $2`,
    [id, courseId]
  );
  if (!inCatalog) return NextResponse.json({ error: "This course is not part of the semester's curriculum." }, { status: 404 });

  const allocated = await queryOne(
    `select 1 from allocation_semesters where semester_id = $1 and course_id = $2`,
    [id, courseId]
  );
  if (allocated) {
    return NextResponse.json(
      { error: "This course already has a teacher allocated in this semester and cannot be removed from the curriculum." },
      { status: 409 }
    );
  }

  await query(`delete from semester_courses where semester_id = $1 and course_id = $2`, [id, courseId]);
  return NextResponse.json({ success: true });
}
