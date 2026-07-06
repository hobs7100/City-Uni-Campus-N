import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { hashPassword, generateRandomPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const existing = await queryOne<{ name: string; email: string }>(
    `select name, email from users where id = $1 and deleted_at is null`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const newPassword = generateRandomPassword();
  const passwordHash = await hashPassword(newPassword);
  await queryOne(`update users set password_hash = $1, updated_at = now() where id = $2`, [passwordHash, id]);

  const emailResult = await sendPasswordResetEmail({
    to: existing.email,
    name: existing.name,
    password: newPassword,
  });

  return NextResponse.json({
    success: true,
    emailSent: emailResult.success,
    emailError: emailResult.success ? undefined : emailResult.error,
    ...(emailResult.success ? {} : { generatedPassword: newPassword }),
  });
}
