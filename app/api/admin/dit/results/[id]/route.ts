import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const patchSchema = z.object({
  obtained_marks: z.coerce.number().int().min(0).optional(),
  is_absent: z.boolean().optional(),
  remarks: z.string().nullable().optional(),
});

// PATCH /api/admin/dit/results/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ obtained_marks: number; is_absent: boolean; total_marks: number }>(
      `select dmr.obtained_marks, dmr.is_absent, ts.total_marks
       from dit_mock_results dmr join dit_test_series ts on ts.id = dmr.test_series_id
       where dmr.id = $1 for update of dmr`,
      [id]
    );
    if (!result.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "Result not found." }, { status: 404 });
    }
    const current = result.rows[0];
    const isAbsent = parsed.data.is_absent ?? current.is_absent;
    const obtainedMarks = isAbsent ? 0 : (parsed.data.obtained_marks ?? current.obtained_marks);
    if (obtainedMarks > current.total_marks) {
      await client.query("rollback");
      return NextResponse.json({ error: `Obtained marks cannot exceed total marks (${current.total_marks}).` }, { status: 400 });
    }
    await client.query(
      `update dit_mock_results set obtained_marks=$1, is_absent=$2,
       remarks=case when $3::boolean then $4 else remarks end, updated_at=now() where id=$5`,
      [obtainedMarks, isAbsent, parsed.data.remarks !== undefined, parsed.data.remarks ?? null, id]
    );
    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    console.error("DIT result admin update error:", error);
    return NextResponse.json({ error: "Failed to update result." }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/admin/dit/results/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const { id } = await params;
  const existing = await queryOne(`select id from dit_mock_results where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Result not found." }, { status: 404 });

  await query(`delete from dit_mock_results where id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
