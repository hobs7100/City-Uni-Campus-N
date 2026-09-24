import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { dates, resultRows, uuid, validDateRange } from "../_lib";
import { assembleStudentReport, type AttendanceWeek, type ReportIdentity } from "../_report";
import { query } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  student_id: uuid, from_date: z.string().date().optional(), to_date: z.string().date().optional(),
  test_series_id: uuid.optional(), class_id: uuid.optional(), semester_id: uuid.optional(),
  course_id: uuid.optional(), session: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const p = parsed.data;
  const d = dates(p.from_date, p.to_date);
  if (!validDateRange(d.from, d.to)) return NextResponse.json({ error: "from_date must not be after to_date." }, { status: 400 });
  const rows = await resultRows({ from: d.from, to: d.to, studentId: p.student_id,
    testSeriesId: p.test_series_id, classId: p.class_id, semesterId: p.semester_id,
    courseId: p.course_id, session: p.session });
  if (!rows.length) return NextResponse.json({ error: "Student has no DIT results in the selected period." }, { status: 404 });
  const attendance_weeks = await query<AttendanceWeek>(
    `select to_char(attendance_date, 'YYYY-MM') as month,
            ((extract(day from attendance_date)::int - 1) / 7 + 1)::int as week,
            count(*) filter (where status = 'present')::int as presents,
            count(*) filter (where status = 'absent')::int as absents,
            count(*) filter (where status = 'leave')::int as leaves
     from student_attendance_records
     where student_id = $1 and attendance_date >= $2::date and attendance_date <= $3::date
     group by 1, 2 order by 1, 2`,
    [p.student_id, d.from, d.to],
  );
  const identity = await query<ReportIdentity>(
    `select s.id, s.name, s.father_name, s.roll_no, s.profile_image_url, c.class_name, s.session
     from students s join classes c on c.id = s.class_id
     where s.id = $1 and s.deleted_at is null`,
    [p.student_id],
  );
  const r = rows[0];
  const student = identity[0] ?? { id: r.student_id, name: r.student_name, father_name: r.father_name,
    roll_no: r.roll_no, profile_image_url: null, class_name: r.class_name, session: r.session };
  return NextResponse.json(assembleStudentReport(rows, student, attendance_weeks, {
    class_id: r.class_id, class_name: r.class_name, session: r.session,
    semester_id: r.semester_id, semester_number: r.semester_number, term_type: r.term_type,
  }, raw, d.from, d.to));
}