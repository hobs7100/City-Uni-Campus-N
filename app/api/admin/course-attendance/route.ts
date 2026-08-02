import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const sp           = request.nextUrl.searchParams;
  const courseId     = sp.get("course_id");
  const deptId       = sp.get("department_id");
  const dateFrom     = sp.get("date_from");
  const dateTo       = sp.get("date_to");
  const mismatchOnly = sp.get("mismatch_only") === "true";

  const params: unknown[] = [];
  let pIdx = 1;

  const whereClauses: string[] = [];

  if (courseId) {
    whereClauses.push(`al.course_id = $${pIdx++}`);
    params.push(courseId);
  }
  if (deptId) {
    whereClauses.push(`te.department_id = $${pIdx++}`);
    params.push(deptId);
  }

  let dateFilter = "";
  if (dateFrom) {
    dateFilter += ` AND ar.attendance_date >= $${pIdx++}`;
    params.push(dateFrom);
  }
  if (dateTo) {
    dateFilter += ` AND ar.attendance_date <= $${pIdx++}`;
    params.push(dateTo);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // teacher_count  = slots where marked_by IS NULL (teacher-reported)
  // coord_count    = slots where a system user (coordinator / admin / HoD)
  //                  explicitly marked the record (marked_by IS NOT NULL)
  const rows = await query(
    `SELECT
       c.title          AS course_title,
       c.code           AS course_code,
       c.credit_hours,
       cl.id            AS class_id,
       cl.class_name,
       cl.session,
       s.semester_number,
       te.id            AS teacher_id,
       te.name          AS teacher_name,
       te.type          AS teacher_type,
       COALESCE((
         SELECT COUNT(*)
         FROM   attendance_records ar
         WHERE  ar.allocation_id = al.id
         AND    ar.marked_by IS NULL
         ${dateFilter}
       ), 0)::int AS teacher_count,
       COALESCE((
         SELECT COUNT(*)
         FROM   attendance_records ar
         WHERE  ar.allocation_id = al.id
         AND    ar.marked_by IS NOT NULL
         ${dateFilter}
       ), 0)::int AS coord_count
     FROM   allocations al
     JOIN   courses c                ON c.id  = al.course_id
     JOIN   teachers te              ON te.id = al.teacher_id
     JOIN   allocation_semesters als ON als.allocation_id = al.id
     JOIN   semesters s              ON s.id  = als.semester_id
     JOIN   classes cl               ON cl.id = s.class_id
     ${whereSQL}
     GROUP  BY c.title, c.code, c.credit_hours,
               cl.id, cl.class_name, cl.session, s.semester_number,
               te.id, te.name, te.type, al.id
     ${mismatchOnly ? "HAVING COALESCE((SELECT COUNT(*) FROM attendance_records ar WHERE ar.allocation_id = al.id AND ar.marked_by IS NULL" + dateFilter + "), 0) != COALESCE((SELECT COUNT(*) FROM attendance_records ar WHERE ar.allocation_id = al.id AND ar.marked_by IS NOT NULL" + dateFilter + "), 0)" : ""}
     ORDER  BY cl.class_name, cl.session, s.semester_number`,
    params
  );

  return NextResponse.json({ groups: rows });
}
