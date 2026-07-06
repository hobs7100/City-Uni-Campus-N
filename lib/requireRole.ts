import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { UserRole } from "./session";

export async function requireRole(...roles: UserRole[]) {
  const session = await getSession();
  if (!session.isLoggedIn || !roles.includes(session.role)) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 403 }) };
  }
  return { session, response: null };
}
