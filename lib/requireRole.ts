import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "./session";
import type { UserRole } from "./session";
import { isPortalManagedRole, isPortalModule } from "./portalPermissionsConfig";
import { query } from "./db";

interface PortalPermissionRow {
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export async function requireRole(...roles: UserRole[]) {
  const session = await getSession();
  // "assistant" shares the same route-level access as "admin".
  // Any route that permits "admin" automatically permits "assistant" too.
  const effective = roles.includes("admin") ? [...roles, "assistant" as UserRole] : roles;
  let portalGranted = false;
  if (session.isLoggedIn && isPortalManagedRole(session.role)) {
    const requestHeaders = await headers();
    const targetModule = requestHeaders.get("x-portal-target-module");
    const action = requestHeaders.get("x-portal-action");
    if (targetModule && isPortalModule(targetModule) && ["view", "edit", "delete"].includes(action ?? "")) {
      const readParents = (requestHeaders.get("x-portal-read-parents") ?? "")
        .split(",")
        .filter(isPortalModule);
      const modules = action === "view" ? [targetModule, ...readParents] : [targetModule];
      const permissions = await query<PortalPermissionRow>(
        `select module, can_view, can_edit, can_delete
         from portal_permissions
         where role = $1 and module = any($2::text[])`,
        [session.role, modules],
      );
      const target = permissions.find((permission) => permission.module === targetModule);
      const allowed =
        action === "view"
          ? target?.can_view === true ||
            permissions.some(
              (permission) =>
                readParents.includes(permission.module as (typeof readParents)[number]) &&
                permission.can_view,
            )
          : target?.can_view === true &&
            (action === "delete" ? target.can_delete === true : target.can_edit === true);
      if (!allowed) {
        return {
          session: null,
          response: NextResponse.json(
            { error: "Portal Management denied this module action." },
            { status: 403 },
          ),
        };
      }
      portalGranted = roles.includes("admin");
    }
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
