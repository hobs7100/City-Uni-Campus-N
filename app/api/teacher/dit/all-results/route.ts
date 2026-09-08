import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const updateSchema = z.object({
  id: z.string().uuid(),
  obtained_marks: z.coerce.number().int().min(0),
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
            dmr.test_date::text, dmr.obtained_marks, dmr.remarks,
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
    const result = await client.query<{ total_marks: number }>(
      `select ts.total_marks from dit_mock_results dmr
       join dit_test_series ts on ts.id = dmr.test_series_id
       where dmr.id = $1 and dmr.submitted_by = $2 for update of dmr`,
      [parsed.data.id, session!.userId]
    );
    if (!result.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "Result not found or not owned by you." }, { status: 404 });
    }
    if (parsed.data.obtained_marks > result.rows[0].total_marks) {
      await client.query("rollback");
      return NextResponse.json({ error: `Obtained marks cannot exceed total marks (${result.rows[0].total_marks}).` }, { status: 400 });
    }
    await client.query("update dit_mock_results set obtained_marks=$1, updated_at=now() where id=$2 and submitted_by=$3",
      [parsed.data.obtained_marks, parsed.data.id, session!.userId]);
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