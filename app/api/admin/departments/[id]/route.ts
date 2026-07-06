import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  name: z.string().min(2).optional(),
  hod_id: z.string().uuid().nullable().optional(),
  coordinator_id: z.string().uuid().nullable().optional(),
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

  if (d.name) {
    const existing = await queryOne(`select id from departments where lower(name) = lower($1) and id != $2`, [
      d.name,
      id,
    ]);
    if (existing) {
      return NextResponse.json({ error: "A department with this name already exists." }, { status: 409 });
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(d)) {
    sets.push(`${key} = $${i++}`);
    values.push(value === undefined ? null : value);
  }
  sets.push("updated_at = now()");
  values.push(id);

  const department = await queryOne(`update departments set ${sets.join(", ")} where id = $${i} returning *`, values);
  if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });
  return NextResponse.json({ department });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const used = await queryOne(`select id from classes where department_id = $1 limit 1`, [id]);
  if (used) {
    return NextResponse.json(
      { error: "This department has classes assigned and cannot be deleted." },
      { status: 409 }
    );
  }

  await query(`delete from departments where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
