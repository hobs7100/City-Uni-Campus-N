import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// ── GET /api/teacher/dit/results ─────────────────────────────────────────────
// Returns active students for a DIT class+semester, with any saved marks for
// the selected test_series + allocation + test_date.
// Required: allocation_id, semester_id
// Optional: test_series_id, test_date  (used to pre-populate saved results)
export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const sp = request.nextUrl.searchParams;
  const allocationId  = sp.get("allocation_id");
  const semesterId    = sp.get("semester_id");
  const testSeriesId  = sp.get("test_series_id");
  const testDate      = sp.get("test_date");

  if (!allocationId || !semesterId)
    return NextResponse.json({ error: "allocation_id and semester_id are required." }, { status: 400 });

  // The allocation, its semester link, the semester and the DIT class are one
  // authorization graph; do not authorize an allocation independently.
  const owned = await queryOne<{ course_id: string }>(
    `select a.course_id
     from allocations a
     join allocation_semesters als on als.allocation_id = a.id
     join semesters sem            on sem.id = als.semester_id
     join classes cl               on cl.id  = sem.class_id
     where a.id = $1 and a.teacher_id = $2 and als.semester_id = $3
        and a.status = 'active' and sem.status = 'active' and cl.type = 'DIT'
     limit 1`,
    [allocationId, session!.userId, semesterId]
  );
  if (!owned)
    return NextResponse.json({ error: "Not authorized or not an active DIT allocation." }, { status: 403 });

  const students = await query<{
    student_id: string;
    name: string;
     father_name: string | null;
    roll_no: string | null;
    obtained_marks: number | null;
    remarks: string | null;
    result_id: string | null;
    attendance_pct: number | null;
  }>(
    `select s.id       as student_id,
            s.name,
             s.father_name,
            s.roll_no,
            dmr.obtained_marks,
            dmr.remarks,
            dmr.id     as result_id,
            (
              select round(
                count(case when sca.status = 'present' then 1 end) * 100.0 /
                nullif(count(case when sca.status in ('present', 'absent') then 1 end), 0)
              , 1)
              from student_course_attendance sca
              where sca.student_id    = s.id
                and sca.allocation_id = $1
                and sca.marked_by     = $5
            ) as attendance_pct
     from students s
     join semesters sem on sem.class_id = s.class_id
     left join dit_mock_results dmr
       on  dmr.student_id    = s.id
       and dmr.allocation_id = $1
       and dmr.semester_id   = $2
        and dmr.submitted_by  = $5
       and ($3::uuid is null or dmr.test_series_id = $3::uuid)
       and ($4::date is null or dmr.test_date      = $4::date)
     where sem.id = $2
       and s.status      = 'active'
        and s.deleted_at  is null
     order by s.name asc`,
    [allocationId, semesterId, testSeriesId ?? null, testDate ?? null, session!.userId]
  );

  return NextResponse.json({ students });
}

// ── POST /api/teacher/dit/results ────────────────────────────────────────────
const rowSchema = z.object({
  student_id:     z.string().uuid(),
  obtained_marks: z.coerce.number().int().min(0),
  remarks:        z.string().nullable().optional(),
});

const bodySchema = z.object({
  allocation_id:  z.string().uuid(),
  semester_id:    z.string().uuid(),
  test_series_id: z.string().uuid(),
  test_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows:           z.array(rowSchema).min(1),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const d = parsed.data;

  const submittedIds = d.rows.map((row) => row.student_id);
  if (new Set(submittedIds).size !== submittedIds.length)
    return NextResponse.json({ error: "A student can only appear once in a result batch." }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const graph = await client.query<{ class_id: string }>(
      `select sem.class_id
       from allocations a
       join allocation_semesters als on als.allocation_id = a.id
       join semesters sem on sem.id = als.semester_id
       join classes cl on cl.id = sem.class_id
       where a.id = $1 and a.teacher_id = $2 and a.status = 'active'
         and als.semester_id = $3 and sem.status = 'active' and cl.type = 'DIT'
       for update of a, als, sem`,
      [d.allocation_id, session!.userId, d.semester_id]
    );
    if (!graph.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "Not authorized for this active DIT course and semester." }, { status: 403 });
    }
    const seriesResult = await client.query<{ total_marks: number }>(
      "select total_marks from dit_test_series where id = $1 for key share", [d.test_series_id]
    );
    if (!seriesResult.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "Test series not found." }, { status: 404 });
    }
    const totalMarks = seriesResult.rows[0].total_marks;
    if (d.rows.some((row) => row.obtained_marks > totalMarks)) {
      await client.query("rollback");
      return NextResponse.json({ error: `Obtained marks cannot exceed total marks (${totalMarks}).` }, { status: 400 });
    }
    const validStudents = await client.query<{ id: string }>(
      `select id from students
       where id = any($1::uuid[]) and class_id = $2 and status = 'active' and deleted_at is null
       for key share`,
      [submittedIds, graph.rows[0].class_id]
    );
    if (validStudents.rowCount !== submittedIds.length) {
      await client.query("rollback");
      return NextResponse.json({ error: "Every submitted student must be an active student in this semester's class." }, { status: 400 });
    }
    await client.query(
      `insert into dit_mock_results
       (test_series_id, allocation_id, semester_id, student_id, test_date, obtained_marks, remarks, submitted_by)
       select $1, $2, $3, r.student_id, $4, r.obtained_marks, r.remarks, $5
       from jsonb_to_recordset($6::jsonb) as r(student_id uuid, obtained_marks integer, remarks text)
       on conflict (test_series_id, allocation_id, semester_id, student_id, test_date)
       do update set obtained_marks = excluded.obtained_marks, remarks = excluded.remarks, updated_at = now()
       where dit_mock_results.submitted_by = $5`,
      [d.test_series_id, d.allocation_id, d.semester_id, d.test_date, session!.userId,
        JSON.stringify(d.rows.map(({ student_id, obtained_marks, remarks }) => ({ student_id, obtained_marks, remarks: remarks ?? null })))]
    );
    // An existing row authored by somebody else is never overwritten.
    const changed = await client.query<{ count: string }>(
      `select count(*)::text as count from dit_mock_results
       where test_series_id=$1 and allocation_id=$2 and semester_id=$3 and test_date=$4
         and submitted_by=$5 and student_id = any($6::uuid[])`,
      [d.test_series_id, d.allocation_id, d.semester_id, d.test_date, session!.userId, submittedIds]
    );
    if (Number(changed.rows[0].count) !== submittedIds.length)
      throw new Error("One or more result rows are not owned by this teacher.");

    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("rollback");
    console.error("DIT mock results save error:", err);
    return NextResponse.json({ error: "Failed to save results." }, { status: 500 });
  } finally {
    client.release();
  }
}
