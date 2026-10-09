import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { accountTable } from "@/lib/passwordSession";
import { personalPasswordSchema } from "@/lib/password-policy";
import { roleHomePage } from "@/lib/auth-redirect";

const schema = z.object({
  new_password: personalPasswordSchema,
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "The passwords do not match.",
  path: ["confirm_password"],
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Please sign in again.", redirectTo: "/login" }, { status: 401 });
  }
  if (!session.mustChangePassword) {
    return NextResponse.json({ error: "Use your profile to change your existing password." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid password." }, { status: 400 });
  }
  const hash = await hashPassword(parsed.data.new_password);
  // Compare-and-swap prevents a concurrent reset or a second onboarding cookie
  // from overwriting the password just chosen by the account owner.
  const saved = await queryOne<{ password_version: number }>(
    `update ${accountTable(session)}
     set password_hash = $1, must_change_password = false,
         password_version = password_version + 1, updated_at = now()
     where id = $2 and password_version = $3 and must_change_password = true
       and deleted_at is null and status::text != 'blocked'
     returning password_version`,
    [hash, session.userId, session.passwordVersion ?? 0],
  );
  if (!saved) {
    return NextResponse.json({ error: "Your account was changed. Please sign in again.", redirectTo: "/login" }, { status: 409 });
  }
  session.mustChangePassword = false;
  session.passwordVersion = saved.password_version;
  await session.save();
  return NextResponse.json({ success: true, redirectTo: roleHomePage[session.role] });
}
