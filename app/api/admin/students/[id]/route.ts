import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  name: z.string().min(2).optional(),
  father_name: z.string().optional().nullable(),
  cnic: z.string().min(5).optional(),
  contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  department_id: z.string().uuid().optional(),
  session: z.string().min(1).optional(),
  class_id: z.string().uuid().optional(),
  profile_image_url: z.string().optional().nullable(),
  status: z.enum(["active", "struck_off", "left", "dropped", "freezed"]).optional(),
  status_change_date: z.string().optional().nullable(),
  status_change_semester: z.coerce.number().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  if (d.cnic) {
    const existing = await queryOne(`select id from students where cnic = $1 and id != $2`, [d.cnic, id]);
    if (existing) return NextResponse.json({ error: "A student with this CNIC already exists." }, { status: 409 });
  }
  if (d.email) {
    const existing = await queryOne(`select id from students where email = $1 and id != $2`, [
      d.email.toLowerCase(), id,
    ]);
    if (existing) return NextResponse.json({ error: "A student with this email already exists." }, { status: 409 });
  }

  const { password, ...rest } = d;
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    sets.push(`${key} = $${i++}`);
    values.push(key === "email" && typeof value === "string" ? value.toLowerCase() : value);
  }
  if (password) {
    sets.push(`password_hash = $${i++}`);
    values.push(await hashPassword(password));
  }
  // When status changes, record who made the change
  if (d.status !== undefined) {
    sets.push(`status_changed_by_name = $${i++}`);
    values.push(session!.name);
  }
  if (rest.status && !["left", "dropped", "freezed"].includes(rest.status)) {
    sets.push(`status_change_date = $${i++}`);
    values.push(null);
    sets.push(`status_change_semester = $${i++}`);
    values.push(null);
  }
  sets.push("updated_at = now()");
  values.push(id);

  const student = await queryOne(
    `update students set ${sets.join(", ")} where id = $${i} and deleted_at is null returning id, name, email, status`,
    values
  );
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  return NextResponse.json({ student });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;
  await query(`update students set deleted_at = now() where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
