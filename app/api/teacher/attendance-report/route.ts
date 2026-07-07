import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const courseId = request.nextUrl.searchParams.get("course_id");
  const classId = request.nextUrl.searchParams.get("class_id");

  const conditions: string[] = [`a.teacher_id = $1`];
  const values: unknown[] = [session!.userId];
  let i = 2;
  if (from) { conditions.push(`ar.attendance_date >= $${i++}`); values.push(from); }
  if (to) { conditions.push(`ar.attendance_date <= $${i++}`); values.push(to); }
  if (courseId) { conditions.push(`c.id = $${i++}`); values.push(courseId); }
  if (classId) {
    conditions.push(
      `exists (select 1 from allocation_semesters als_f join semesters s_f on s_f.id = als_f.semester_id where als_f.allocation_id = a.id and s_f.class_id = $${i++})`
    );
    values.push(classId);
  }

  const records = await query(
    `select ar.id, ar.attendance_date, ar.lecture_count, ar.late_minutes, ar.status, ar.remarks,
            c.code as course_code, c.title as course_title, a.is_combined,
            coalesce(
              (select json_agg(json_build_object('class_name', cl2.class_name, 'session', cl2.session) order by cl2.class_name)
               from allocation_semesters als2
               join semesters s2 on s2.id = als2.semester_id
               join classes cl2 on cl2.id = s2.class_id
               where als2.allocation_id = a.id),
              '[]'
            ) as classes
     from attendance_records ar
     join allocations a on a.id = ar.allocation_id
     join courses c on c.id = a.course_id
     where ${conditions.join(" and ")}
     order by ar.attendance_date desc`,
    values
  );

  return NextResponse.json({ records });
}
