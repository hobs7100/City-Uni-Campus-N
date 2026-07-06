import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const rows = await query(
    `select r.*, co.code as course_code, co.title as course_title, co.credit_hours,
            sem.semester_number, sem.term_type
     from results r
     join courses co on co.id = r.course_id
     join semesters sem on sem.id = r.semester_id
     where r.student_id = $1
     order by sem.semester_number, co.code`,
    [session!.userId]
  );

  const bySemester = new Map<number, { semester_number: number; term_type: string; courses: Record<string, unknown>[] }>();
  for (const r of rows as Record<string, unknown>[]) {
    const semNum = r.semester_number as number;
    if (!bySemester.has(semNum)) {
      bySemester.set(semNum, { semester_number: semNum, term_type: r.term_type as string, courses: [] });
    }
    bySemester.get(semNum)!.courses.push(r);
  }

  return NextResponse.json({ semesters: Array.from(bySemester.values()) });
}
