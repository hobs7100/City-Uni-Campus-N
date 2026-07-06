import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const row = await queryOne<{ total_students: string; passed: string; failed: string }>(
    `select
       (select count(distinct student_id) from results) as total_students,
       (select count(distinct student_id) from results r1
          where r1.status not in ('fail')
            and not exists (select 1 from results r2 where r2.student_id = r1.student_id and r2.status = 'fail')
       ) as passed,
       (select count(distinct student_id) from results where status = 'fail') as failed
    `
  );

  return NextResponse.json({
    total_students: Number(row?.total_students ?? 0),
    passed: Number(row?.passed ?? 0),
    failed: Number(row?.failed ?? 0),
  });
}
