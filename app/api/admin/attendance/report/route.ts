import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator", "finance_manager");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const classId = request.nextUrl.searchParams.get("class_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const teacherId = request.nextUrl.searchParams.get("teacher_id");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`cl.department_id = $${i++}`); values.push(departmentId); }
  if (classId) { conditions.push(`cl.id = $${i++}`); values.push(classId); }
  if (semesterId) { conditions.push(`als.semester_id = $${i++}`); values.push(semesterId); }
  if (teacherId) { conditions.push(`al.teacher_id = $${i++}`); values.push(teacherId); }
  if (from) { conditions.push(`ar.attendance_date >= $${i++}`); values.push(from); }
  if (to) { conditions.push(`ar.attendance_date <= $${i++}`); values.push(to); }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const records = await query(
    `select distinct on (ar.id) ar.id, ar.attendance_date, ar.lecture_count, ar.late_minutes, ar.status, ar.remarks,
            al.id as allocation_id, c.code as course_code, c.title as course_title,
            te.id as teacher_id, te.name as teacher_name,
            cl.class_name, cl.session, cl.department_id, d.name as department_name,
            s.semester_number, s.term_type
     from attendance_records ar
     join allocations al on al.id = ar.allocation_id
     join courses c on c.id = al.course_id
     join teachers te on te.id = al.teacher_id
     join allocation_semesters als on als.allocation_id = al.id
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     join departments d on d.id = cl.department_id
     ${where}
     order by ar.id, ar.attendance_date desc`,
    values
  );

  records.sort((a: unknown, b: unknown) => {
    const ra = a as { attendance_date: string | Date };
    const rb = b as { attendance_date: string | Date };
    return new Date(rb.attendance_date).getTime() - new Date(ra.attendance_date).getTime();
  });

  return NextResponse.json({ records });
}
