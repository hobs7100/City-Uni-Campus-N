import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const student = await queryOne<{ class_id: string }>(`select class_id from students where id = $1 and deleted_at is null`, [session!.userId]);
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const semester = await queryOne<{ id: string }>(`select id from semesters where class_id = $1 and status = 'active'`, [student.class_id]);
  if (!semester) return NextResponse.json({ timetable: null });

  const timetable = await queryOne(
    `select id from timetables where class_id = $1 and semester_id = $2`,
    [student.class_id, semester.id]
  );

  return NextResponse.json({ timetable });
}
