import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

interface ScheduleRow {
  day_name: string;
  start_time: string;
  end_time: string;
  allocation_id: string;
  course_code: string;
  course_title: string;
  is_combined: boolean;
  classes: { class_id: string; class_name: string; session: string }[];
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const [teacher, scheduleRows, workload] = await Promise.all([
    queryOne<{
      name: string;
      type: "permanent" | "visiting";
      workload_credit_hours: string | null;
    }>(
      `select name, type, workload_credit_hours::text
       from teachers
       where id = $1 and deleted_at is null`,
      [session!.userId]
    ),
    query<ScheduleRow>(
      `select distinct
         td.day_name,
         tp.start_time,
         tp.end_time,
         a.id as allocation_id,
         c.code as course_code,
         c.title as course_title,
         a.is_combined,
         coalesce(
           (
             select jsonb_agg(
               jsonb_build_object(
                 'class_id', cl2.id,
                 'class_name', cl2.class_name,
                 'session', cl2.session
               )
               order by cl2.class_name, cl2.session
             )
             from allocation_semesters als2
             join semesters s2 on s2.id = als2.semester_id and s2.status = 'active'
             join semester_courses sc2
               on sc2.semester_id = als2.semester_id
              and sc2.course_id = als2.course_id
              and sc2.syllabus_completed_at is null
             join classes cl2 on cl2.id = s2.class_id
             where als2.allocation_id = a.id
           ),
           '[]'::jsonb
         ) as classes
       from timetable_cells tc
       join timetables tt on tt.id = tc.timetable_id
       join semesters timetable_semester
         on timetable_semester.id = tt.semester_id
        and timetable_semester.status = 'active'
       join timetable_days td on td.id = tc.day_id
       join timetable_periods tp on tp.id = tc.period_id
       join allocations a
         on a.id = tc.allocation_id
        and a.teacher_id = $1
        and a.status = 'active'
       join courses c on c.id = a.course_id
       join allocation_semesters timetable_als
         on timetable_als.allocation_id = a.id
        and timetable_als.semester_id = tt.semester_id
       join semester_courses timetable_sc
         on timetable_sc.semester_id = timetable_als.semester_id
        and timetable_sc.course_id = timetable_als.course_id
        and timetable_sc.syllabus_completed_at is null
       where td.day_name = any($2::text[])
       order by tp.start_time, tp.end_time, td.day_name, c.title`,
      [session!.userId, WEEKDAYS]
    ),
    queryOne<{ assigned_credit_hours: string }>(
      `select coalesce(sum(x.credit_hours), 0)::text as assigned_credit_hours
       from (
         select a.id, c.credit_hours
         from allocations a
         join courses c on c.id = a.course_id
         where a.teacher_id = $1
           and a.status = 'active'
           and exists (
             select 1
             from allocation_semesters als
             join semesters s on s.id = als.semester_id and s.status = 'active'
             join semester_courses sc
               on sc.semester_id = als.semester_id
              and sc.course_id = als.course_id
              and sc.syllabus_completed_at is null
             where als.allocation_id = a.id
           )
       ) x`,
      [session!.userId]
    ),
  ]);

  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  }

  const slots = Array.from(
    new Map(
      scheduleRows.map((row) => [
        `${row.start_time}-${row.end_time}`,
        { start_time: row.start_time, end_time: row.end_time },
      ])
    ).values()
  ).sort((a, b) =>
    a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time)
  );

  const cellMap = new Map<string, ScheduleRow[]>();
  for (const row of scheduleRows) {
    const key = `${row.day_name}-${row.start_time}-${row.end_time}`;
    const existing = cellMap.get(key) ?? [];
    if (!existing.some((course) => course.allocation_id === row.allocation_id)) {
      existing.push(row);
      cellMap.set(key, existing);
    }
  }

  const committed = teacher.workload_credit_hours === null
    ? null
    : Number(teacher.workload_credit_hours);
  const assigned = Number(workload?.assigned_credit_hours ?? 0);
  const workloadStatus = committed === null
    ? "Not Set"
    : assigned === committed
      ? "Completed"
      : assigned < committed
        ? "Underload"
        : "Overload";

  return NextResponse.json({
    teacher: {
      name: teacher.name,
      type: teacher.type,
    },
    workload: {
      committed_credit_hours: committed,
      assigned_credit_hours: assigned,
      status: workloadStatus,
    },
    slots,
    days: WEEKDAYS.map((dayName) => ({
      day_name: dayName,
      cells: slots.map((slot) => ({
        start_time: slot.start_time,
        end_time: slot.end_time,
        courses: cellMap.get(`${dayName}-${slot.start_time}-${slot.end_time}`) ?? [],
      })),
    })),
  });
}