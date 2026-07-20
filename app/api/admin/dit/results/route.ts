import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/admin/dit/results
// Query params (all optional, individually or combined):
//   student_id, session, semester_id, test_series_id, from_date, to_date
export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const sp = request.nextUrl.searchParams;
  const studentId    = sp.get("student_id");
  const session      = sp.get("session");
  const semesterId   = sp.get("semester_id");
  const testSeriesId = sp.get("test_series_id");
  const fromDate     = sp.get("from_date");
  const toDate       = sp.get("to_date");

  const conditions: string[] = ["cl.type = 'DIT'", "s.deleted_at is null"];
  const vals: unknown[] = [];
  let i = 1;

  if (studentId)    { conditions.push(`dmr.student_id = $${i++}`);    vals.push(studentId); }
  if (session)      { conditions.push(`cl.session = $${i++}`);         vals.push(session); }
  if (semesterId)   { conditions.push(`dmr.semester_id = $${i++}`);   vals.push(semesterId); }
  if (testSeriesId) { conditions.push(`dmr.test_series_id = $${i++}`); vals.push(testSeriesId); }
  if (fromDate)     { conditions.push(`dmr.test_date >= $${i++}`);    vals.push(fromDate); }
  if (toDate)       { conditions.push(`dmr.test_date <= $${i++}`);    vals.push(toDate); }

  const results = await query<{
    id: string;
    student_id: string;
    student_name: string;
    father_name: string | null;
    profile_image_url: string | null;
    roll_no: string | null;
    class_id: string;
    class_name: string;
    session: string;
    semester_number: number;
    term_type: string;
    semester_id: string;
    test_series_id: string;
    test_series_name: string;
    total_marks: number;
    passing_marks: number;
    course_title: string;
    course_code: string;
    allocation_id: string;
    test_date: string;
    obtained_marks: number;
    remarks: string | null;
    teacher_name: string;
  }>(
    `select dmr.id,
            s.id                                       as student_id,
            s.name                                     as student_name,
            s.father_name,
            s.profile_image_url,
            s.roll_no,
            cl.id                                      as class_id,
            cl.class_name,
            cl.session,
            sem.semester_number,
            sem.term_type,
            dmr.semester_id,
            ts.id                                      as test_series_id,
            ts.name                                    as test_series_name,
            ts.total_marks,
            ts.passing_marks,
            co.title                                   as course_title,
            co.code                                    as course_code,
            dmr.allocation_id,
            to_char(dmr.test_date, 'YYYY-MM-DD')      as test_date,
            dmr.obtained_marks,
            dmr.remarks,
            t.name                                     as teacher_name
     from dit_mock_results dmr
     join students s          on s.id  = dmr.student_id
     join dit_test_series ts  on ts.id = dmr.test_series_id
     join allocations a        on a.id  = dmr.allocation_id
     join courses co           on co.id = a.course_id
     join semesters sem        on sem.id = dmr.semester_id
     join classes cl           on cl.id = sem.class_id
     join teachers t           on t.id  = dmr.submitted_by
     where ${conditions.join(" and ")}
     order by dmr.test_date desc, s.name asc`,
    vals
  );

  return NextResponse.json({ results });
}
