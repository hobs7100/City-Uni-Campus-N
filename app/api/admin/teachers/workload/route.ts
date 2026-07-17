import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const rows = await query<{
    teacher_id: string;
    teacher_name: string;
    department_id: string;
    department_name: string;
    type: "permanent" | "visiting";
    workload_decided: string | null;
    allocation_id: string | null;
    course_code: string | null;
    course_title: string | null;
    credit_hours: string | null;
    class_name: string | null;
    session: string | null;
    semester_id: string | null;
    result_uploaded: boolean;
  }>(
    `select
       t.id            as teacher_id,
       t.name          as teacher_name,
       t.department_id,
       d.name          as department_name,
       t.type,
       t.workload_credit_hours as workload_decided,
       a.id            as allocation_id,
       c.code          as course_code,
       c.title         as course_title,
       c.credit_hours::text  as credit_hours,
       cl.class_name,
       cl.session,
       s.id            as semester_id,
       exists (
         select 1 from results r
         where r.semester_id = s.id and r.course_id = c.id
       ) as result_uploaded
     from teachers t
     join departments d on d.id = t.department_id
     left join allocations a on a.teacher_id = t.id
     left join allocation_semesters als on als.allocation_id = a.id
     left join semesters s on s.id = als.semester_id and s.status = 'active'
     left join courses c on c.id = a.course_id
     left join classes cl on cl.id = s.class_id
     where t.deleted_at is null
       and t.status = 'active'
     order by t.name, c.title, cl.class_name`,
    []
  );

  return NextResponse.json({ rows });
}
