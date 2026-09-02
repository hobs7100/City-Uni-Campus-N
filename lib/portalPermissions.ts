import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import type { UserRole } from "@/lib/session";
import type { PortalAction, PortalModule } from "@/lib/portalPermissionsConfig";

interface PermissionRow {
  can_edit: boolean;
  can_delete: boolean;
}

export interface PortalAccess {
  canEdit: boolean;
  canDelete: boolean;
}

export async function getPortalAccess(
  role: UserRole,
  module: PortalModule,
): Promise<PortalAccess> {
  if (role === "admin") return { canEdit: true, canDelete: true };

  const permission = await queryOne<PermissionRow>(
    `select can_edit, can_delete
     from portal_permissions
     where role = $1 and module = $2`,
    [role, module],
  );

  return {
    canEdit: permission?.can_edit ?? true,
    canDelete: permission?.can_delete ?? true,
  };
}

export async function requirePortalPermission(
  module: PortalModule,
  action: PortalAction,
  ...roles: UserRole[]
) {
  const result = await requireRole(...roles);
  if (result.response || !result.session) return result;

  const access = await getPortalAccess(result.session.role, module);
  const allowed = action === "edit" ? access.canEdit : access.canDelete;
  if (!allowed) {
    const actionLabel = action === "edit" ? "editing" : "deleting";
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