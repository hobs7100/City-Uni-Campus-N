import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { query } from "@/lib/db";
import { z } from "zod";
import { resultRows, uuid, validDateRange } from "../_lib";
import { assembleStudentReport, type AttendanceWeek, type ReportContext, type ReportIdentity } from "../_report";

const schema = z.object({
  from_date: z.string().date(), to_date: z.string().date(),
  class_id: uuid, session: z.string().min(1), semester_id: uuid,
});

export async function GET(req: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (raw.options === "1") {
    const classes = await query<{ id: string; name: string; session: string }>(
      `select id, class_name as name, session from classes
       where type = 'DIT' and status = 'active' order by session desc, class_name`,
    );
    const semesters = await query<{ id: string; name: string; class_id: string }>(
      `select sem.id, sem.semester_number::text as name, sem.class_id
       from semesters sem join classes cl on cl.id = sem.class_id
       where cl.type = 'DIT' and cl.status = 'active'
       order by sem.semester_number`,
    );
    return NextResponse.json({ classes, sessions: [...new Set(classes.map((c) => c.session))], semesters });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Choose a date range, active DIT class, session, and semester." }, { status: 400 });
  const p = parsed.data;
  if (!validDateRange(p.from_date, p.to_date)) return NextResponse.json({ error: "From date must not be after to date." }, { status: 400 });
  const contexts = await query<ReportContext>(
    `select cl.id as class_id, cl.class_name, cl.session, sem.id as semester_id,
            sem.semester_number, sem.term_type
     from classes cl join semesters sem on sem.class_id = cl.id
     where cl.id = $1 and cl.session = $2 and sem.id = $3
       and cl.type = 'DIT' and cl.status = 'active'`,
    [p.class_id, p.session, p.semester_id],
  );
  if (!contexts.length) return NextResponse.json({ error: "The selected class, session, and semester do not match an active DIT class." }, { status: 400 });
  const students = await query<ReportIdentity>(
    `select s.id, s.name, s.father_name, s.roll_no, s.profile_image_url, cl.class_name, cl.session
     from students s join classes cl on cl.id = s.class_id
     where s.class_id = $1 and s.deleted_at is null
     order by s.roll_no asc nulls last, s.name, s.id`,
    [p.class_id],
  );
  if (!students.length) return NextResponse.json({ error: "This class has no students." }, { status: 404 });
  const [rows, attendance] = await Promise.all([
    resultRows({ from: p.from_date, to: p.to_date, classId: p.class_id,
      semesterId: p.semester_id, session: p.session }),
    query<AttendanceWeek & { student_id: string }>(
      `select sar.student_id, to_char(sar.attendance_date, 'YYYY-MM') as month,
              ((extract(day from sar.attendance_date)::int - 1) / 7 + 1)::int as week,
              count(*) filter (where sar.status = 'present')::int as presents,
              count(*) filter (where sar.status = 'absent')::int as absents,
              count(*) filter (where sar.status = 'leave')::int as leaves
       from student_attendance_records sar join students s on s.id = sar.student_id
       where s.class_id = $1 and s.deleted_at is null
         and sar.attendance_date >= $2::date and sar.attendance_date <= $3::date
       group by 1, 2, 3 order by 1, 2, 3`,
      [p.class_id, p.from_date, p.to_date],
    ),
  ]);
  const byStudent = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = byStudent.get(row.student_id) ?? [];
    group.push(row);
    byStudent.set(row.student_id, group);
  }
  const byAttendance = new Map<string, AttendanceWeek[]>();
  for (const { student_id, ...week } of attendance) {
    const group = byAttendance.get(student_id) ?? [];
    group.push(week);
    byAttendance.set(student_id, group);
  }
  return NextResponse.json({ reports: students.map((student) => assembleStudentReport(
    byStudent.get(student.id) ?? [], student, byAttendance.get(student.id) ?? [],
    contexts[0], raw, p.from_date, p.to_date,
  )) });
}