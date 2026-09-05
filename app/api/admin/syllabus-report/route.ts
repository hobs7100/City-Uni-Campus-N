import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const filterSchema = z.string().uuid().optional();

interface ActiveSemesterOption {
  id: string;
  department_id: string;
  department_name: string;
  class_id: string;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
}

interface SyllabusReportRow extends ActiveSemesterOption {
  course_id: string;
  course_code: string;
  course_title: string;
  teacher_name: string | null;
  credit_hours: string;
  allowed_lectures: string;
  delivered_lectures: string;
}

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod");
  if (response) return response;

  const parsedSemesterId = filterSchema.safeParse(
    request.nextUrl.searchParams.get("semester_id") || undefined,
  );
  if (!parsedSemesterId.success) {
    return NextResponse.json({ error: "Invalid semester filter." }, { status: 400 });
  }
  const semesterId = parsedSemesterId.data;

  const semesters = await query<ActiveSemesterOption>(
    `select s.id, s.department_id, d.name as department_name,
            s.class_id, cl.class_name, cl.session,
            s.semester_number, s.term_type
     from semesters s
     join classes cl on cl.id = s.class_id
     join departments d on d.id = s.department_id
     where s.status = 'active' and cl.status = 'active'
     order by d.name, cl.class_name, cl.session, s.semester_number`,
  );

  const rows = await query<SyllabusReportRow>(
    `with attendance_totals as (
       select allocation_id, coalesce(sum(lecture_count), 0) as delivered_lectures
       from attendance_records
       where status = 'ok'
       group by allocation_id
     ),
     active_allocations as (
       select als.semester_id, als.course_id, a.id as allocation_id,
              t.name as teacher_name,
              row_number() over (
                partition by als.semester_id, als.course_id
                order by a.started_at desc nulls last, a.created_at desc
              ) as allocation_rank
       from allocation_semesters als
       join allocations a on a.id = als.allocation_id and a.status = 'active'
       join teachers t on t.id = a.teacher_id and t.deleted_at is null
     )
     select s.id, s.department_id, d.name as department_name,
            s.class_id, cl.class_name, cl.session,
            s.semester_number, s.term_type,
            c.id as course_id, c.code as course_code, c.title as course_title,
            aa.teacher_name, c.credit_hours::text,
            (c.credit_hours * 14)::text as allowed_lectures,
            coalesce(at.delivered_lectures, 0)::text as delivered_lectures
     from semesters s
     join classes cl on cl.id = s.class_id
     join departments d on d.id = s.department_id
     join semester_courses sc on sc.semester_id = s.id
     join courses c on c.id = sc.course_id
     left join active_allocations aa
       on aa.semester_id = s.id
      and aa.course_id = c.id
      and aa.allocation_rank = 1
     left join attendance_totals at on at.allocation_id = aa.allocation_id
     where s.status = 'active'
       and cl.status = 'active'
       and ($1::uuid is null or s.id = $1::uuid)
     order by d.name, cl.class_name, cl.session, s.semester_number, c.title`,
    [semesterId ?? null],
  );

  return NextResponse.json({ semesters, rows });
}