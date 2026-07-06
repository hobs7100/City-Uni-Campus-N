import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { hashPassword, generateRandomPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { sendWelcomeEmail } from "@/lib/email";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  cellno: z.string().optional().nullable(),
  role: z.enum(["admin", "hod", "coordinator"]),
  status: z.enum(["active", "blocked"]).default("active"),
});

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const role = request.nextUrl.searchParams.get("role");
  const users = role
    ? await query(
        `select id, name, email, cellno, role, status, created_at
         from users where deleted_at is null and role = $1 and status = 'active' order by name asc`,
        [role]
      )
    : await query(
        `select id, name, email, cellno, role, status, created_at
         from users where deleted_at is null order by created_at desc`
      );
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const { name, email, cellno, role, status } = parsed.data;

  const existing = await queryOne(`select id from users where email = $1`, [email.toLowerCase()]);
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);
  const user = await queryOne(
    `insert into users (name, email, password_hash, cellno, role, status)
     values ($1, $2, $3, $4, $5, $6)
     returning id, name, email, cellno, role, status, created_at`,
    [name, email.toLowerCase(), passwordHash, cellno || null, role, status]
  );

  const emailResult = await sendWelcomeEmail({ to: email.toLowerCase(), name, password: generatedPassword });

  return NextResponse.json(
    {
      user,
      emailSent: emailResult.success,
      emailError: emailResult.success ? undefined : emailResult.error,
      ...(emailResult.success ? {} : { generatedPassword }),
    },
    { status: 201 }
  );
}
