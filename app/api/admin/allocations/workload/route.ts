import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

interface WorkloadDetail {
  allocation_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  assigned_date: string;
  classes: string[];
}

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const teacherId = request.nextUrl.searchParams.get("teacher_id");
  if (!teacherId) {
    return NextResponse.json({ error: "teacher_id is required." }, { status: 400 });
  }

  const teacher = await queryOne<{
    id: string;
    type: "permanent" | "visiting";
    total_committed: string | null;
  }>(
    `select id, type, workload_credit_hours::text as total_committed
     from teachers
     where id = $1 and deleted_at is null`,
    [teacherId],
  );

  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  }

  if (teacher.type !== "permanent") {
    return NextResponse.json({
      teacher_type: teacher.type,
      current_workload: "0",
      total_committed: "0",
      details: [],
    });
  }

  const details = await query<WorkloadDetail>(
    `select
       a.id as allocation_id,
       c.code as course_code,
       c.title as course_title,
       c.credit_hours::text as credit_hours,
       to_char(coalesce(a.started_at, a.created_at::date), 'YYYY-MM-DD') as assigned_date,
       array_agg(
         distinct cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number
         order by cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number
       ) as classes
     from allocations a
     join courses c on c.id = a.course_id
     join allocation_semesters als on als.allocation_id = a.id
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     where a.teacher_id = $1
       and a.status = 'active'
       and s.status in ('active', 'mid_term')
       and coalesce(a.started_at, a.created_at::date) <= current_date
       and (a.end_date is null or a.end_date >= current_date)
     group by a.id, c.id, c.code, c.title, c.credit_hours, a.started_at, a.created_at
     order by coalesce(a.started_at, a.created_at::date), c.code`,
    [teacherId],
  );

  const currentWorkload = details.reduce(
    (total, detail) => total + Number(detail.credit_hours),
    0,
  );

  return NextResponse.json({
    teacher_type: teacher.type,
    current_workload: String(currentWorkload),
    total_committed: teacher.total_committed ?? "0",
    details,
  });
}