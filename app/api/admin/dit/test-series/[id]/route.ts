import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  name: z.string().min(1).max(200).optional(),
  total_marks: z.coerce.number().int().positive().optional(),
  passing_marks: z.coerce.number().int().min(0).optional(),
});

// PATCH /api/admin/dit/test-series/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const existing = await queryOne<{ total_marks: number; passing_marks: number; name: string }>(
    `select total_marks, passing_marks, name from dit_test_series where id = $1`, [id]
  );
  if (!existing) return NextResponse.json({ error: "Test series not found." }, { status: 404 });

  const newTotal   = parsed.data.total_marks   ?? existing.total_marks;
  const newPassing = parsed.data.passing_marks ?? existing.passing_marks;
  if (newPassing > newTotal)
    return NextResponse.json({ error: "Passing marks cannot exceed total marks." }, { status: 400 });

  await query(
    `update dit_test_series
     set name = $1, total_marks = $2, passing_marks = $3, updated_at = now()
     where id = $4`,
    [parsed.data.name ?? existing.name, newTotal, newPassing, id]
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/dit/test-series/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const { id } = await params;
  const has = await queryOne<{ ok: boolean }>(
    `select exists (select 1 from dit_mock_results where test_series_id = $1) as ok`, [id]
  );
  if (has?.ok)
    return NextResponse.json(
      { error: "Cannot delete a test series that has submitted results. Delete the results first." },
      { status: 409 }
    );

  await query(`delete from dit_test_series where id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
