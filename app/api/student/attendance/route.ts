import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const student = await queryOne<{ class_id: string }>(`select class_id from students where id = $1 and deleted_at is null`, [session!.userId]);
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const semester = await queryOne(`select id, semester_number, term_type from semesters where class_id = $1 and status = 'active'`, [student.class_id]);
  if (!semester) {
    return NextResponse.json({ semester: null, summary: null, records: [] });
  }

  const conditions: string[] = [`student_id = $1`, `semester_id = $2`];
  const values: unknown[] = [session!.userId, (semester as { id: string }).id];
  let i = 3;
  if (from) { conditions.push(`attendance_date >= $${i++}`); values.push(from); }
  if (to) { conditions.push(`attendance_date <= $${i++}`); values.push(to); }

  const records = await query(
    `select attendance_date, status, reason, call_remarks from student_attendance_records
     where ${conditions.join(" and ")}
     order by attendance_date desc`,
    values
  );

  const presents = records.filter((r) => (r as { status: string }).status === "present").length;
  const absents = records.filter((r) => (r as { status: string }).status === "absent").length;
  const leaves = records.filter((r) => (r as { status: string }).status === "leave").length;
  const percentage = presents + absents > 0 ? (presents / (presents + absents)) * 100 : 0;
  const flag = percentage < 50 ? "struck_off" : percentage < 75 ? "warning" : "ok";

  return NextResponse.json({
    semester,
    summary: { presents, absents, leaves, percentage: Number(percentage.toFixed(2)), flag },
    records,
  });
}
