import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const teachers = await query(
    `select t.id, t.name, t.email, t.phone, t.type, t.status,
            t.workload_credit_hours, t.rate_per_hour,
            d.name as department_name,
            count(distinct a.id) filter (
              where exists (
                select 1 from allocation_semesters als
                join semesters s on s.id = als.semester_id
                where als.allocation_id = a.id and s.status = 'active'
              )
            ) as active_allocations
     from teachers t
     join departments d on d.id = t.department_id
     where d.hod_id = $1 and t.deleted_at is null
     group by t.id, d.name
     order by t.name`,
    [session!.userId]
  );

  return NextResponse.json({ teachers });
}
