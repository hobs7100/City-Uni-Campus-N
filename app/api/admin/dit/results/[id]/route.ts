import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const patchSchema = z.object({
  obtained_marks: z.coerce.number().int().min(0).optional(),
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

  const row = await queryOne<{ test_series_id: string }>(
    `select test_series_id from dit_mock_results where id = $1`, [id]
  );
  if (!row) return NextResponse.json({ error: "Result not found." }, { status: 404 });

  if (parsed.data.obtained_marks !== undefined) {
    const series = await queryOne<{ total_marks: number }>(
      `select total_marks from dit_test_series where id = $1`, [row.test_series_id]
    );
    if (series && parsed.data.obtained_marks > series.total_marks)
      return NextResponse.json(
        { error: `Obtained marks cannot exceed total marks (${series.total_marks}).` },
        { status: 400 }
      );
  }

  await query(
    `update dit_mock_results
     set obtained_marks = coalesce($1, obtained_marks),
         remarks        = coalesce($2, remarks),
         updated_at     = now()
     where id = $3`,
    [parsed.data.obtained_marks ?? null, parsed.data.remarks ?? null, id]
  );
  return NextResponse.json({ ok: true });
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
