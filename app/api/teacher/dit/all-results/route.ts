import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const updateSchema = z.object({
  id: z.string().uuid(),
  obtained_marks: z.coerce.number().int().min(0),
  is_absent: z.boolean().optional().default(false),
});

/** Results and filter values are both scoped to the current teacher's authorship. */
export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;
  const p = request.nextUrl.searchParams;
  const values = ["class_id", "semester_id", "course_id", "test_series_id", "test_date"]
    .map((key) => p.get(key));

  const rows = await query(
    `select dmr.id, dmr.student_id, dmr.allocation_id, dmr.semester_id, dmr.test_series_id,
             dmr.test_date::text, dmr.obtained_marks, dmr.is_absent, dmr.remarks,
            s.name as student_name, s.father_name, s.roll_no,
            cl.id as class_id, cl.class_name, cl.session, sem.semester_number, sem.term_type,
            co.id as course_id, co.code as course_code, co.title as course_title,
            ts.name as series_name, ts.total_marks, ts.passing_marks
     from dit_mock_results dmr
     join students s on s.id = dmr.student_id
     join semesters sem on sem.id = dmr.semester_id
     join classes cl on cl.id = sem.class_id
     join allocations a on a.id = dmr.allocation_id
     join courses co on co.id = a.course_id
     join dit_test_series ts on ts.id = dmr.test_series_id
     where dmr.submitted_by = $1
       and ($2::uuid is null or cl.id = $2)
       and ($3::uuid is null or sem.id = $3)
       and ($4::uuid is null or co.id = $4)
       and ($5::uuid is null or ts.id = $5)
       and ($6::date is null or dmr.test_date = $6)
     order by dmr.test_date desc, cl.class_name, sem.semester_number, co.title, s.name`,
    [session!.userId, ...values]
  );
  const options = await query(
    `select distinct cl.id as class_id, cl.class_name, cl.session, sem.id as semester_id,
            sem.semester_number, sem.term_type, co.id as course_id, co.code as course_code,
            co.title as course_title, ts.id as test_series_id, ts.name as series_name,
            dmr.test_date::text as test_date
     from dit_mock_results dmr
     join semesters sem on sem.id = dmr.semester_id
     join classes cl on cl.id = sem.class_id
     join allocations a on a.id = dmr.allocation_id
     join courses co on co.id = a.course_id
     join dit_test_series ts on ts.id = dmr.test_series_id
     where dmr.submitted_by = $1
     order by cl.class_name, sem.semester_number, co.title, ts.name, dmr.test_date desc`,
    [session!.userId]
  );
  return NextResponse.json({ rows, filter_options: options });
}

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("begin");
    // Lock the target first. A row belonging to another teacher is deliberately
    // indistinguishable from a missing result so its existence is not disclosed.
    const target = await client.query<{
      allocation_id: string;
      semester_id: string;
      test_series_id: string;
      submitted_by: string;
    }>(
      `select allocation_id, semester_id, test_series_id, submitted_by
       from dit_mock_results where id = $1 for update`,
      [parsed.data.id]
    );
    if (!target.rowCount || target.rows[0].submitted_by !== session!.userId) {
      await client.query("rollback");
      return NextResponse.json({ error: "Result not found." }, { status: 404 });
    }

    const row = target.rows[0];
    // The author must still own the allocation. This is authorization failure,
    // not a stale-result conflict, because an allocation transfer revokes access.
    const allocationOwned = await client.query(
      "select 1 from allocations where id = $1 and teacher_id = $2",
      [row.allocation_id, session!.userId]
    );
    if (!allocationOwned.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "Not authorized for this result's allocation." }, { status: 403 });
    }

    // Revalidate the entire active DIT graph after locking the result. The
    // allocation course is the course recorded by this result's allocation.
    const result = await client.query<{ total_marks: number }>(
      `select ts.total_marks
       from dit_mock_results dmr
       join allocations a on a.id = dmr.allocation_id
       join courses co on co.id = a.course_id
       join allocation_semesters als on als.allocation_id = a.id and als.semester_id = dmr.semester_id
       join semesters sem on sem.id = als.semester_id
       join classes cl on cl.id = sem.class_id
       join dit_test_series ts on ts.id = dmr.test_series_id
       where dmr.id = $1 and dmr.submitted_by = $2
         and a.teacher_id = $2 and a.status = 'active'
         and sem.status = 'active' and cl.type = 'DIT'
       for key share of a, als, sem, co, ts`,
      [parsed.data.id, session!.userId]
    );
    if (!result.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "This result's DIT allocation or semester is no longer active." }, { status: 409 });
    }
    if (!parsed.data.is_absent && parsed.data.obtained_marks > result.rows[0].total_marks) {
      await client.query("rollback");
      return NextResponse.json({ error: `Obtained marks cannot exceed total marks (${result.rows[0].total_marks}).` }, { status: 400 });
    }
    await client.query("update dit_mock_results set obtained_marks=$1, is_absent=$2, updated_at=now() where id=$3 and submitted_by=$4",
      [parsed.data.is_absent ? 0 : parsed.data.obtained_marks, parsed.data.is_absent, parsed.data.id, session!.userId]);
    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    console.error("DIT result update error:", error);
    return NextResponse.json({ error: "Failed to update result." }, { status: 500 });
  } finally {
    client.release();
  }
}