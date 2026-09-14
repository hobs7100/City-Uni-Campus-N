import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import type { UserRole } from "@/lib/session";
import {
  isPortalManagedRole,
  type PortalAction,
  type PortalModule,
} from "@/lib/portalPermissionsConfig";

interface PermissionRow {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface PortalAccess {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export async function getPortalAccess(
  role: UserRole,
  module: PortalModule,
): Promise<PortalAccess> {
  if (role === "admin") return { canView: true, canEdit: true, canDelete: true };

  // Portal permissions are deny-by-default. Non-managed roles retain their
  // existing route-level authorization but never receive portal mutations from
  // this centralized policy unless they have an explicit row.
  if (!isPortalManagedRole(role)) {
    return { canView: false, canEdit: false, canDelete: false };
  }

  const permission = await queryOne<PermissionRow>(
    `select can_view, can_edit, can_delete
     from portal_permissions
     where role = $1 and module = $2`,
    [role, module],
  );

  return {
    canView: permission?.can_view ?? false,
    canEdit: permission?.can_edit ?? false,
    canDelete: permission?.can_delete ?? false,
  };
}

export async function getPortalAccessMap(role: UserRole): Promise<Map<PortalModule, PortalAccess>> {
  const access = new Map<PortalModule, PortalAccess>();
  if (role === "admin") {
    return access;
  }
  if (!isPortalManagedRole(role)) return access;

  const rows = await query<PermissionRow & { module: PortalModule }>(
    `select module, can_view, can_edit, can_delete
     from portal_permissions
     where role = $1`,
    [role],
  );
  for (const row of rows) {
    access.set(row.module, {
      canView: row.can_view,
      canEdit: row.can_edit,
      canDelete: row.can_delete,
    });
  }
  return access;
}

export async function requirePortalPermission(
  module: PortalModule,
  action: PortalAction,
  ...roles: UserRole[]
) {
  const result = await requireRole(...roles);
  if (result.response || !result.session) return result;

  const access = await getPortalAccess(result.session.role, module);
  const allowed =
    action === "view"
      ? access.canView
      : access.canView && (action === "edit" ? access.canEdit : access.canDelete);
  if (!allowed) {
    const actionLabel =
      action === "view" ? "viewing" : action === "edit" ? "editing" : "deleting";
    return {
      session: null,
      response: NextResponse.json(
        { error: `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} is locked by Portal Management.` },
        { status: 403 },
      ),
    };
  }

  return result;
}