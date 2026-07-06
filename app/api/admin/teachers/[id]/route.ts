import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  name: z.string().min(2).optional(),
  department_id: z.string().uuid().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  type: z.enum(["permanent", "visiting"]).optional(),
  workload_credit_hours: z.coerce.number().optional().nullable(),
  rate_per_hour: z.coerce.number().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  account_title: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
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

  if (d.email) {
    const existing = await queryOne(`select id from teachers where email = $1 and id != $2`, [
      d.email.toLowerCase(),
      id,
    ]);
    if (existing) return NextResponse.json({ error: "A teacher with this email already exists." }, { status: 409 });
  }

  const { password, ...rest } = d;
  if (rest.type === "visiting") {
    rest.workload_credit_hours = null;
  }

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
  sets.push("updated_at = now()");
  values.push(id);

  const teacher = await queryOne(
    `update teachers set ${sets.join(", ")} where id = $${i} and deleted_at is null returning id, name, email, status`,
    values
  );
  if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  return NextResponse.json({ teacher });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;
  await query(`update teachers set deleted_at = now() where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
