import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const courseId = request.nextUrl.searchParams.get("course_id");
  const dateFrom = request.nextUrl.searchParams.get("date_from");
  const dateTo   = request.nextUrl.searchParams.get("date_to");

  if (!courseId) {
    return NextResponse.json({ error: "course_id is required." }, { status: 400 });
  }

  const params: unknown[] = [courseId];
  let pIdx = 2;
  let dateFilter = "";

  if (dateFrom) {
    dateFilter += ` AND ar.attendance_date >= $${pIdx}`;
    params.push(dateFrom);
    pIdx++;
  }
  if (dateTo) {
    dateFilter += ` AND ar.attendance_date <= $${pIdx}`;
    params.push(dateTo);
  }

  // teacher_count  = lecture slots where marked_by IS NULL
  //                  (teacher-reported, entered without a system user context)
  //
  // coord_count    = lecture slots where a specific user (coordinator, admin,
  //                  HoD, etc.) explicitly marked the record — i.e. any row
  //                  where marked_by IS NOT NULL.
  //
  // Both come from the same attendance_records table.  Because the unique
  // constraint is (allocation_id, date, start_time, end_time), each slot lands
  // in exactly one bucket.  A mismatch highlights unverified (teacher-side only)
  // vs verified (coordinator/admin-side) lecture slots.

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
       ), 0) AS teacher_count,
       COALESCE((
         SELECT COUNT(*)
         FROM   attendance_records ar
         WHERE  ar.allocation_id = al.id
         AND    ar.marked_by IS NOT NULL
         ${dateFilter}
       ), 0) AS coord_count
     FROM   allocations al
     JOIN   courses c                ON c.id  = al.course_id
     JOIN   teachers te              ON te.id = al.teacher_id
     JOIN   allocation_semesters als ON als.allocation_id = al.id
     JOIN   semesters s              ON s.id  = als.semester_id
     JOIN   classes cl               ON cl.id = s.class_id
     WHERE  al.course_id = $1
     GROUP  BY c.title, c.code, c.credit_hours,
               cl.id, cl.class_name, cl.session, s.semester_number,
               te.id, te.name, te.type, al.id
     ORDER  BY cl.class_name, cl.session, s.semester_number`,
    params
  );

  return NextResponse.json({ groups: rows });
}
