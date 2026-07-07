import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { generateRandomPassword, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { sendWelcomeEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().min(2),
  department_id: z.string().uuid(),
  phone: z.string().optional().nullable(),
  email: z.string().email(),
  type: z.enum(["permanent", "visiting"]),
  workload_credit_hours: z.coerce.number().optional().nullable(),
  rate_per_hour: z.coerce.number().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  account_title: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  status: z.enum(["active", "blocked"]).default("active"),
});

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator", "finance_manager");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const conditions = ["t.deleted_at is null"];
  const values: unknown[] = [];
  if (departmentId) {
    conditions.push(`t.department_id = $1`);
    values.push(departmentId);
  }

  const teachers = await query(
    `select t.id, t.name, t.department_id, d.name as department_name, t.phone, t.email, t.type,
            t.workload_credit_hours, t.rate_per_hour, t.bank_name, t.account_title, t.account_number,
            t.status, t.created_at
     from teachers t
     join departments d on d.id = t.department_id
     where ${conditions.join(" and ")}
     order by t.created_at desc`,
    values
  );
  return NextResponse.json({ teachers });
}

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await queryOne(`select id from teachers where email = $1`, [d.email.toLowerCase()]);
  if (existing) return NextResponse.json({ error: "A teacher with this email already exists." }, { status: 409 });

  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);

  const teacher = await queryOne(
    `insert into teachers
      (name, department_id, phone, email, password_hash, type, workload_credit_hours, rate_per_hour,
       bank_name, account_title, account_number, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning id, name, email, status`,
    [
      d.name,
      d.department_id,
      d.phone || null,
      d.email.toLowerCase(),
      passwordHash,
      d.type,
      d.type === "permanent" ? d.workload_credit_hours ?? null : null,
      d.rate_per_hour ?? null,
      d.bank_name || null,
      d.account_title || null,
      d.account_number || null,
      d.status,
    ]
  );

  const emailResult = await sendWelcomeEmail({
    to: (teacher as { email: string }).email,
    name: (teacher as { name: string }).name,
    password: generatedPassword,
  }).catch((e) => ({ success: false, error: String(e) }));

  if (emailResult.success) {
    return NextResponse.json({ teacher, emailSent: true }, { status: 201 });
  }
  return NextResponse.json(
    { teacher, emailSent: false, emailError: emailResult.error, generatedPassword },
    { status: 201 }
  );
}
