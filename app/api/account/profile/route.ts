import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { isDefaultPassword } from "@/lib/password-policy";
import { savePersonalPassword } from "@/lib/passwordSession";

export async function GET() {
  const { session, response } = await requireRole("admin", "hod", "coordinator", "finance_manager", "suprident", "controller", "accountant");
  if (response) return response;

  const user = await queryOne(
    `select id, name, email, cellno, role from users where id = $1 and deleted_at is null`,
    [session!.userId]
  );
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ user });
}

const patchSchema = z.object({
  current_password: z.string().min(1, "Current password is required."),
  new_password: z.string().min(6, "New password must be at least 6 characters."),
});

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireRole("admin", "hod", "coordinator", "finance_manager", "suprident", "controller", "accountant");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const { current_password, new_password } = parsed.data;
  if (isDefaultPassword(new_password)) {
    return NextResponse.json({ error: "Choose your own password, not a default password." }, { status: 400 });
  }

  const account = await queryOne<{ password_hash: string }>(
    `select password_hash from users where id = $1 and deleted_at is null`,
    [session!.userId]
  );
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const valid = await bcrypt.compare(current_password, account.password_hash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const newHash = await bcrypt.hash(new_password, 10);
  const saved = await savePersonalPassword(session!, newHash);
  if (!saved) return NextResponse.json({ error: "Your account was changed. Please sign in again." }, { status: 409 });
  session!.passwordVersion = saved.password_version;
  await session!.save();

  return NextResponse.json({ success: true });
}
