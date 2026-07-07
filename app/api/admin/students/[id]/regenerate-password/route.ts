import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { generateRandomPassword, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const student = await queryOne<{ id: string; name: string; email: string }>(
    `select id, name, email from students where id = $1 and deleted_at is null`,
    [id]
  );
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const newPassword = generateRandomPassword();
  const passwordHash = await hashPassword(newPassword);

  await queryOne(`update students set password_hash = $1, updated_at = now() where id = $2 returning id`, [
    passwordHash,
    id,
  ]);

  const emailResult = await sendPasswordResetEmail({ to: student.email, name: student.name, password: newPassword }).catch(
    (e) => ({ success: false, error: String(e) })
  );

  if (emailResult.success) {
    return NextResponse.json({ success: true, emailSent: true });
  }
  return NextResponse.json({
    success: true,
    emailSent: false,
    emailError: emailResult.error,
    newPassword,
  });
}
