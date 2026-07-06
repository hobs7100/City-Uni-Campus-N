import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  code: z.string().min(1).optional(),
  title: z.string().min(2).optional(),
  department_id: z.string().uuid().optional(),
  credit_hours: z.coerce.number().positive().optional(),
  status: z.enum(["active", "blocked"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  if (d.code || d.department_id) {
    const current = await queryOne<{ code: string; department_id: string }>(
      `select code, department_id from courses where id = $1`,
      [id]
    );
    if (!current) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    const code = d.code ?? current.code;
    const departmentId = d.department_id ?? current.department_id;
    const existing = await queryOne(
      `select id from courses where department_id = $1 and lower(code) = lower($2) and id != $3`,
      [departmentId, code, id]
    );
    if (existing) {
      return NextResponse.json({ error: "A course with this code already exists in this department." }, { status: 409 });
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(d)) {
    if (value === undefined) continue;
    sets.push(`${key} = $${i++}`);
    values.push(value);
  }
  sets.push("updated_at = now()");
  values.push(id);

  const updated = await queryOne(`update courses set ${sets.join(", ")} where id = $${i} returning *`, values);
  if (!updated) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  return NextResponse.json({ course: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const used = await queryOne(`select id from semester_courses where course_id = $1 limit 1`, [id]);
  if (used) {
    return NextResponse.json({ error: "This course is used in a semester and cannot be deleted." }, { status: 409 });
  }

  await query(`delete from courses where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
