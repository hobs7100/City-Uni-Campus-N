import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { UserRole } from "./session";

export async function requireRole(...roles: UserRole[]) {
  const session = await getSession();
  // "assistant" shares the same route-level access as "admin".
  // Any route that permits "admin" automatically permits "assistant" too.
  const effective = roles.includes("admin") ? [...roles, "assistant" as UserRole] : roles;
  if (!session.isLoggedIn || !effective.includes(session.role)) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 403 }) };
  }
  return { session, response: null };
}

export async function requireExactRole(...roles: UserRole[]) {
  const session = await getSession();
  if (!session.isLoggedIn || !roles.includes(session.role)) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 403 }) };
  }
  return { session, response: null };
}
