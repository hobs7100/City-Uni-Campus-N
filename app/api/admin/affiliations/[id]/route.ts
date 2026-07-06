import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  university_name: z.string().min(2).optional(),
  mid_marks: z.coerce.number().min(0).optional(),
  sessional_marks: z.coerce.number().min(0).optional(),
  final_marks: z.coerce.number().min(0).optional(),
  practical_marks: z.coerce.number().min(0).optional(),
  status: z.enum(["active", "blocked"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  if (d.university_name) {
    const existing = await queryOne(
      `select id from affiliations where lower(university_name) = lower($1) and id != $2`,
      [d.university_name, id]
    );
    if (existing) {
      return NextResponse.json({ error: "This university is already registered." }, { status: 409 });
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(d)) {
    sets.push(`${key} = $${i++}`);
    values.push(value);
  }
  sets.push("updated_at = now()");
  values.push(id);

  const affiliation = await queryOne(
    `update affiliations set ${sets.join(", ")} where id = $${i} returning *`,
    values
  );
  if (!affiliation) return NextResponse.json({ error: "Affiliation not found." }, { status: 404 });
  return NextResponse.json({ affiliation });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const used = await queryOne(`select id from classes where affiliation_id = $1 limit 1`, [id]);
  if (used) {
    return NextResponse.json(
      { error: "This affiliation is used by one or more classes and cannot be deleted." },
      { status: 409 }
    );
  }

  await query(`delete from affiliations where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
