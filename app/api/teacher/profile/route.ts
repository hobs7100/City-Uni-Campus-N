import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const teacher = await queryOne(
    `select t.id, t.name, t.email, t.phone, t.type, t.workload_credit_hours, t.rate_per_hour,
            t.bank_name, t.account_title, t.account_number, t.status, d.name as department_name
     from teachers t join departments d on d.id = t.department_id
     where t.id = $1 and t.deleted_at is null`,
    [session!.userId]
  );
  if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  return NextResponse.json({ teacher });
}

const patchSchema = z.object({
  phone: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  account_title: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  current_password: z.string().optional(),
  new_password: z.string().min(6).optional(),
});

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  if (d.new_password) {
    if (!d.current_password) {
      return NextResponse.json({ error: "Current password is required to set a new password." }, { status: 400 });
    }
    const teacher = await queryOne<{ password_hash: string }>(`select password_hash from teachers where id = $1`, [session!.userId]);
    if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    const valid = await bcrypt.compare(d.current_password, teacher.password_hash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    const newHash = await bcrypt.hash(d.new_password, 10);
    await queryOne(`update teachers set password_hash = $1, updated_at = now() where id = $2`, [newHash, session!.userId]);
  }

  const teacher = await queryOne(
    `update teachers set
       phone = coalesce($1, phone),
       bank_name = coalesce($2, bank_name),
       account_title = coalesce($3, account_title),
       account_number = coalesce($4, account_number),
       updated_at = now()
     where id = $5
     returning id, name, email, phone, type, workload_credit_hours, rate_per_hour, bank_name, account_title, account_number, status`,
    [d.phone ?? null, d.bank_name ?? null, d.account_title ?? null, d.account_number ?? null, session!.userId]
  );

  return NextResponse.json({ teacher });
}
