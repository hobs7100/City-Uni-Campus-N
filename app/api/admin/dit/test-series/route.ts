import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  name: z.string().min(1).max(200),
  total_marks: z.coerce.number().int().positive(),
  passing_marks: z.coerce.number().int().min(0),
});

// GET /api/admin/dit/test-series
export async function GET() {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const series = await query(
    `select id, name, total_marks, passing_marks,
            to_char(created_at, 'YYYY-MM-DD') as created_at
     from dit_test_series
     order by created_at desc`,
    []
  );
  return NextResponse.json({ series });
}

// POST /api/admin/dit/test-series
export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const { name, total_marks, passing_marks } = parsed.data;
  if (passing_marks > total_marks)
    return NextResponse.json({ error: "Passing marks cannot exceed total marks." }, { status: 400 });

  const row = await queryOne<{ id: string }>(
    `insert into dit_test_series (name, total_marks, passing_marks) values ($1, $2, $3) returning id`,
    [name, total_marks, passing_marks]
  );
  return NextResponse.json({ id: row!.id }, { status: 201 });
}
