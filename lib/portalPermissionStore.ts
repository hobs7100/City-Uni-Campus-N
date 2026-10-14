import { query } from "./db";
import type { UserRole } from "./session";
import { PORTAL_MODULES, type PortalModule } from "./portalPermissionsConfig";

export interface PortalPermissionRow {
  module: PortalModule;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

/** One effective policy for API checks, navigation and capability responses. */
export async function getPortalPermissionRows(
  role: UserRole,
  modules: PortalModule[] = PORTAL_MODULES.map((module) => module.key),
  userId?: string,
): Promise<PortalPermissionRow[]> {
  if (role !== "assistant") {
    return query<PortalPermissionRow>(
      `select module, can_view, can_edit, can_delete from portal_permissions
       where role = $1 and module = any($2::text[])`,
      [role, modules],
    );
  }
  // Never accidentally grant an assistant role-wide access without identity.
  if (!userId) return [];
  return query<PortalPermissionRow>(
    `select m.module,
       coalesce(a.can_view, p.can_view, false) as can_view,
       coalesce(a.can_edit, p.can_edit, false) as can_edit,
       coalesce(a.can_delete, p.can_delete, false) as can_delete
     from unnest($2::text[]) as m(module)
     join users u on u.id = $3 and u.role = 'assistant'
       and u.deleted_at is null and u.status = 'active'
     left join portal_permissions p on p.role = $1 and p.module = m.module
     left join assistant_module_permissions a on a.user_id = u.id and a.module = m.module`,
    [role, modules, userId],
  );
}
