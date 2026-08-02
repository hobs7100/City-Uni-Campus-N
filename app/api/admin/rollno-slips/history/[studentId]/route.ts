import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/admin/rollno-slips/history/[studentId]
// Returns per-semester attendance history for a student:
//   • overall_pct  — coordinator/admin-marked (student_attendance_records)
//   • courses[]    — teacher-marked (student_course_attendance) per allocation
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const { studentId } = await params;

  // Basic student info
  const student = await queryOne<{
    id: string; name: string; father_name: string | null;
    roll_no: string | null; class_name: string; session: string;
    department_name: string;
  }>(
    `SELECT s.id, s.name, s.father_name, s.roll_no,
            cl.class_name, s.session, d.name AS department_name
     FROM   students s
     JOIN   classes cl ON cl.id = s.class_id
     JOIN   departments d ON d.id = s.department_id
     WHERE  s.id = $1 AND s.deleted_at IS NULL`,
    [studentId]
  );
  if (!student)
    return NextResponse.json({ error: "Student not found." }, { status: 404 });

  // ── Overall attendance per semester (coordinator/admin) ─────────────────────
  const overallRows = await query<{
    semester_id:     string;
    semester_number: number;
    term_type:       string;
    presents:        string;
    absents:         string;
    leaves:          string;
  }>(
    `SELECT
       sem.id              AS semester_id,
       sem.semester_number,
       sem.term_type,
       COUNT(sar.id) FILTER (WHERE sar.status = 'present')::text AS presents,
       COUNT(sar.id) FILTER (WHERE sar.status = 'absent')::text  AS absents,
       COUNT(sar.id) FILTER (WHERE sar.status = 'leave')::text   AS leaves
     FROM   semesters sem
     JOIN   classes cl ON cl.id = sem.class_id
     JOIN   students st ON st.class_id = cl.id AND st.id = $1
     LEFT JOIN student_attendance_records sar
       ON sar.student_id = $1 AND sar.semester_id = sem.id
     GROUP  BY sem.id, sem.semester_number, sem.term_type
     ORDER  BY sem.semester_number`,
    [studentId]
  );

  // ── Course-wise attendance per semester (teacher-marked) ────────────────────
  const courseRows = await query<{
    semester_id:     string;
    semester_number: number;
    course_id:       string;
    course_code:     string;
    course_title:    string;
    teacher_name:    string;
    presents:        string;
    absents:         string;
  }>(
    `SELECT
       sem.id              AS semester_id,
       sem.semester_number,
       c.id                AS course_id,
       c.code              AS course_code,
       c.title             AS course_title,
       te.name             AS teacher_name,
       COUNT(sca.id) FILTER (WHERE sca.status = 'present')::text AS presents,
       COUNT(sca.id) FILTER (WHERE sca.status = 'absent')::text  AS absents
     FROM   student_course_attendance sca
     JOIN   allocations al   ON al.id  = sca.allocation_id
     JOIN   courses c         ON c.id  = al.course_id
     JOIN   teachers te       ON te.id = al.teacher_id
     JOIN   allocation_semesters als ON als.allocation_id = al.id
     JOIN   semesters sem     ON sem.id = als.semester_id
     WHERE  sca.student_id = $1
     GROUP  BY sem.id, sem.semester_number, c.id, c.code, c.title, te.name
     ORDER  BY sem.semester_number, c.code`,
    [studentId]
  );

  // ── Merge into per-semester structure ───────────────────────────────────────
  const coursesBySemester = new Map<string, typeof courseRows>();
  for (const cr of courseRows) {
    if (!coursesBySemester.has(cr.semester_id))
      coursesBySemester.set(cr.semester_id, []);
    coursesBySemester.get(cr.semester_id)!.push(cr);
  }

  const semesters = overallRows.map((r) => {
    const p   = parseInt(r.presents, 10);
    const a   = parseInt(r.absents,  10);
    const l   = parseInt(r.leaves,   10);
    const pct = p + a > 0 ? parseFloat(((p / (p + a)) * 100).toFixed(1)) : null;

    const courses = (coursesBySemester.get(r.semester_id) ?? []).map((cr) => {
      const cp  = parseInt(cr.presents, 10);
      const ca  = parseInt(cr.absents,  10);
      const cpct = cp + ca > 0 ? parseFloat(((cp / (cp + ca)) * 100).toFixed(1)) : null;
      return {
        course_id:    cr.course_id,
        course_code:  cr.course_code,
        course_title: cr.course_title,
        teacher_name: cr.teacher_name,
        presents:     cp,
        absents:      ca,
        att_pct:      cpct,
      };
    });

    return {
      semester_id:     r.semester_id,
      semester_number: r.semester_number,
      term_type:       r.term_type,
      presents:        p,
      absents:         a,
      leaves:          l,
      overall_pct:     pct,
      courses,
    };
  });

  return NextResponse.json({ student, semesters });
}
