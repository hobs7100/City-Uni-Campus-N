import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/student/dit/results
// Returns this student's DIT mock exam results.
// Student must belong to a DIT class (enforced server-side).
// Optional query params: test_series_id, from_date, to_date
export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;
  const studentId = session!.userId;

  // Verify student belongs to a DIT class
  const student = await queryOne<{ class_type: string }>(
    `select cl.type as class_type
     from students st
     join classes cl on cl.id = st.class_id
     where st.id = $1 and st.deleted_at is null`,
    [studentId]
  );
  if (!student) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (student.class_type !== "DIT")
    return NextResponse.json({ error: "Not a DIT student." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const testSeriesId = sp.get("test_series_id");
  const fromDate = sp.get("from_date");
  const toDate = sp.get("to_date");

  const conditions: string[] = ["dmr.student_id = $1"];
  const vals: unknown[] = [studentId];
  let i = 2;

  if (testSeriesId) { conditions.push(`dmr.test_series_id = $${i++}`); vals.push(testSeriesId); }
  if (fromDate)     { conditions.push(`dmr.test_date >= $${i++}`);      vals.push(fromDate); }
  if (toDate)       { conditions.push(`dmr.test_date <= $${i++}`);      vals.push(toDate); }

  const results = await query<{
    id: string;
    test_series_id: string;
    test_series_name: string;
    total_marks: number;
    passing_marks: number;
    test_date: string;
    obtained_marks: number;
    remarks: string | null;
    course_title: string;
    course_code: string;
    semester_number: number;
    term_type: string;
  }>(
    `select dmr.id,
            ts.id                                 as test_series_id,
            ts.name                               as test_series_name,
            ts.total_marks,
            ts.passing_marks,
            to_char(dmr.test_date, 'YYYY-MM-DD') as test_date,
            dmr.obtained_marks,
            dmr.remarks,
            co.title                              as course_title,
            co.code                               as course_code,
            sem.semester_number,
            sem.term_type
     from dit_mock_results dmr
     join dit_test_series ts on ts.id = dmr.test_series_id
     join allocations a       on a.id  = dmr.allocation_id
     join courses co          on co.id = a.course_id
     join semesters sem       on sem.id = dmr.semester_id
     where ${conditions.join(" and ")}
     order by dmr.test_date asc, ts.name asc`,
    vals
  );

  // Distinct series the student has results for (for filter dropdown)
  const seriesList = await query<{ id: string; name: string }>(
    `select distinct ts.id, ts.name
     from dit_mock_results dmr
     join dit_test_series ts on ts.id = dmr.test_series_id
     where dmr.student_id = $1
     order by ts.name asc`,
    [studentId]
  );

  return NextResponse.json({ results, series_list: seriesList });
}
