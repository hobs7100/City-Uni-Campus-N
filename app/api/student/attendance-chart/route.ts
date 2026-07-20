import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/student/attendance-chart
// Returns daily cumulative attendance % for the student's active semester.
export async function GET() {
  const { session, response } = await requireRole("student");
  if (response) return response;
  const studentId = session!.userId;

  const student = await queryOne<{ class_id: string }>(
    `select class_id from students where id = $1 and deleted_at is null`,
    [studentId]
  );
  if (!student) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Active semester (fall back to latest closed if none active)
  const sem = await queryOne<{ id: string; semester_number: number; term_type: string }>(
    `select id, semester_number, term_type
     from semesters
     where class_id = $1 and status in ('active','closed')
     order by (status = 'active') desc, semester_number desc
     limit 1`,
    [student.class_id]
  );
  if (!sem) return NextResponse.json({ points: [], semester: null });

  // All attendance records for this semester ordered by date
  const records = await query<{ attendance_date: string; status: string }>(
    `select to_char(attendance_date, 'YYYY-MM-DD') as attendance_date, status
     from student_attendance_records
     where student_id = $1 and semester_id = $2
     order by attendance_date asc`,
    [studentId, sem.id]
  );

  // Build cumulative percentage per day (leaves excluded from denominator)
  let presents = 0;
  let absents = 0;
  const points = records.map((r) => {
    if (r.status === "present") presents++;
    else if (r.status === "absent") absents++;
    const total = presents + absents;
    const pct = total > 0 ? Math.round((presents / total) * 100) : 100;
    const d = new Date(r.attendance_date + "T00:00:00");
    const label = d.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
    return { date: r.attendance_date, label, cumulative_pct: pct };
  });

  return NextResponse.json({
    semester: { number: sem.semester_number, term_type: sem.term_type },
    points,
  });
}
