import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const teacherId = request.nextUrl.searchParams.get("teacher_id");

  const conditions: string[] = ["te.type = 'visiting'"];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`te.department_id = $${i++}`); values.push(departmentId); }
  if (teacherId) { conditions.push(`te.id = $${i++}`); values.push(teacherId); }

  const rows = await query(
    `select al.id as allocation_id, al.allocation_type, al.rate,
            c.id as course_id, c.code as course_code, c.title as course_title,
            te.id as teacher_id, te.name as teacher_name,
            te.department_id,
            array_agg(distinct cl.class_name || ' (' || cl.session || ') - Sem ' || s.semester_number) as classes,
            coalesce((select sum(ar.lecture_count) from attendance_records ar where ar.allocation_id = al.id and ar.bill_item_id is null), 0) as total_lectures
     from allocations al
     join teachers te on te.id = al.teacher_id
     join courses c on c.id = al.course_id
     join allocation_semesters als on als.allocation_id = al.id
     join semesters s on s.id = als.semester_id and s.status = 'closed'
     join classes cl on cl.id = s.class_id
     where ${conditions.join(" and ")}
     group by al.id, al.allocation_type, al.rate, c.id, c.code, c.title, te.id, te.name, te.department_id
     having coalesce((select sum(ar.lecture_count) from attendance_records ar where ar.allocation_id = al.id and ar.bill_item_id is null), 0) > 0
     order by te.name, c.code`,
    values
  );

  const items = rows.map((r) => {
    const row = r as Record<string, unknown> & { allocation_type: string; rate: string; total_lectures: string };
    const rate = Number(row.rate);
    const lectures = Number(row.total_lectures);
    const amount = row.allocation_type === "fixed" ? rate : rate * lectures;
    return { ...row, amount };
  });

  return NextResponse.json({ items });
}
