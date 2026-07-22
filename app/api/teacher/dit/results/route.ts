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

  // Verify ownership + active DIT
  const owned = await queryOne<{ course_id: string }>(
    `select a.course_id
     from allocations a
     join allocation_semesters als on als.allocation_id = a.id
     join semesters sem            on sem.id = als.semester_id
     join classes cl               on cl.id  = sem.class_id
     where a.id = $1 and a.teacher_id = $2 and als.semester_id = $3
       and a.status = 'active' and cl.type = 'DIT'
     limit 1`,
    [allocationId, session!.userId, semesterId]
  );
  if (!owned)
    return NextResponse.json({ error: "Not authorized or not an active DIT allocation." }, { status: 403 });

  const students = await query<{
    student_id: string;
    name: string;
    roll_no: string | null;
    obtained_marks: number | null;
    remarks: string | null;
    result_id: string | null;
    attendance_pct: number | null;
  }>(
    `select s.id       as student_id,
            s.name,
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
  roll_no:        z.string().nullable().optional(),
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

  // Ownership + DIT + active check
  const owned = await queryOne<{ course_id: string }>(
    `select a.course_id
     from allocations a
     join allocation_semesters als on als.allocation_id = a.id
     join semesters sem            on sem.id = als.semester_id
     join classes cl               on cl.id  = sem.class_id
     where a.id = $1 and a.teacher_id = $2 and als.semester_id = $3
       and a.status = 'active' and cl.type = 'DIT'
     limit 1`,
    [d.allocation_id, session!.userId, d.semester_id]
  );
  if (!owned)
    return NextResponse.json({ error: "Not authorized or not an active DIT allocation." }, { status: 403 });

  // Validate marks ≤ total_marks
  const series = await queryOne<{ total_marks: number }>(
    `select total_marks from dit_test_series where id = $1`, [d.test_series_id]
  );
  if (!series) return NextResponse.json({ error: "Test series not found." }, { status: 404 });

  const overLimit = d.rows.find((r) => r.obtained_marks > series.total_marks);
  if (overLimit)
    return NextResponse.json(
      { error: `Obtained marks cannot exceed total marks (${series.total_marks}).` },
      { status: 400 }
    );

  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const row of d.rows) {
      // Update roll_no on student if provided and currently blank
      if (row.roll_no) {
        await client.query(
          `update students set roll_no = $1, updated_at = now()
           where id = $2 and (roll_no is null or roll_no = '')`,
          [row.roll_no, row.student_id]
        );
      }

      await client.query(
        `insert into dit_mock_results
           (test_series_id, allocation_id, semester_id, student_id,
            test_date, obtained_marks, remarks, submitted_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (test_series_id, allocation_id, semester_id, student_id, test_date)
         do update set
           obtained_marks = excluded.obtained_marks,
           remarks        = excluded.remarks,
           submitted_by   = excluded.submitted_by,
           updated_at     = now()`,
        [
          d.test_series_id, d.allocation_id, d.semester_id,
          row.student_id, d.test_date, row.obtained_marks,
          row.remarks ?? null, session!.userId,
        ]
      );
    }

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
