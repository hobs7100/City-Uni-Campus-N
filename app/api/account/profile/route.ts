import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { session, response } = await requireRole("admin", "hod", "coordinator", "finance_manager");
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
  const { session, response } = await requireRole("admin", "hod", "coordinator", "finance_manager");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const { current_password, new_password } = parsed.data;

  const account = await queryOne<{ password_hash: string }>(
    `select password_hash from users where id = $1 and deleted_at is null`,
    [session!.userId]
  );
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const valid = await bcrypt.compare(current_password, account.password_hash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const newHash = await bcrypt.hash(new_password, 10);
  await queryOne(`update users set password_hash = $1, updated_at = now() where id = $2`, [
    newHash,
    session!.userId,
  ]);

  return NextResponse.json({ success: true });
}
