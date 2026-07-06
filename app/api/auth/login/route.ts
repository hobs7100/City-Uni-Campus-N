import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAccountByEmail, recordLoginActivity, verifyPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid email and password." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const account = await findAccountByEmail(email.toLowerCase().trim());

  if (!account) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (account.status === "blocked" || account.status === "struck_off") {
    return NextResponse.json(
      { error: "Your account has been blocked. Please contact the administration." },
      { status: 403 }
    );
  }

  const validPassword = await verifyPassword(password, account.password_hash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await getSession();
  session.userId = account.id;
  session.role = account.role;
  session.name = account.name;
  session.email = account.email;
  session.isLoggedIn = true;
  await session.save();

  const actorType = account.source === "users" ? "user" : account.source === "teachers" ? "teacher" : "student";
  await recordLoginActivity(
    actorType,
    account.id,
    account.email,
    request.headers.get("x-forwarded-for"),
    request.headers.get("user-agent")
  );

  return NextResponse.json({ role: account.role, name: account.name });
}
