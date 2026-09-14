import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "./session";
import type { UserRole } from "./session";
import { isPortalManagedRole, isPortalModule } from "./portalPermissionsConfig";

export async function requireRole(...roles: UserRole[]) {
  const session = await getSession();
  // "assistant" shares the same route-level access as "admin".
  // Any route that permits "admin" automatically permits "assistant" too.
  const effective = roles.includes("admin") ? [...roles, "assistant" as UserRole] : roles;
  let portalGranted = false;
  if (
    session.isLoggedIn &&
    roles.includes("admin") &&
    isPortalManagedRole(session.role) &&
    !effective.includes(session.role)
  ) {
    const moduleGrant = (await headers()).get("x-portal-module-grant");
    portalGranted = moduleGrant !== null && isPortalModule(moduleGrant);
  }
  if (!session.isLoggedIn || (!effective.includes(session.role) && !portalGranted)) {
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
