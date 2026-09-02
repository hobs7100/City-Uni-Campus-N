import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireExactRole } from "@/lib/requireRole";
import {
  isPortalManagedRole,
  isPortalModule,
  PORTAL_MANAGED_ROLES,
  PORTAL_MODULES,
  type PortalManagedRole,
  type PortalModule,
} from "@/lib/portalPermissionsConfig";

interface PermissionRow {
  role: PortalManagedRole;
  module: PortalModule;
  can_edit: boolean;
  can_delete: boolean;
}

const updateSchema = z.object({
  role: z.string().refine(isPortalManagedRole, "Invalid role."),
  module: z.string().refine(isPortalModule, "Invalid module."),
  action: z.enum(["edit", "delete"]),
  allowed: z.boolean(),
});

export async function GET() {
  const { response } = await requireExactRole("admin");
  if (response) return response;

  const rows = await query<PermissionRow>(
    `select role::text, module, can_edit, can_delete
     from portal_permissions
     where role::text = any($1::text[]) and module = any($2::text[])`,
    [
      PORTAL_MANAGED_ROLES.map((role) => role.key),
      PORTAL_MODULES.map((module) => module.key),
    ],
  );
  const overrides = new Map(rows.map((row) => [`${row.role}:${row.module}`, row]));

  const permissions = PORTAL_MANAGED_ROLES.flatMap((role) =>
    PORTAL_MODULES.map((module) => {
      const row = overrides.get(`${role.key}:${module.key}`);
      return {
        role: role.key,
        module: module.key,
        canEdit: row?.can_edit ?? true,
        canDelete: row?.can_delete ?? true,
      };
    }),
  );

  return NextResponse.json({
    roles: PORTAL_MANAGED_ROLES,
    modules: PORTAL_MODULES,
    permissions,
  });
}

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireExactRole("admin");
  if (response || !session) return response;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid permission." },
      { status: 400 },
    );
  }

  const { role, module, action, allowed } = parsed.data;
  const editValue = action === "edit" ? allowed : true;
  const deleteValue = action === "delete" ? allowed : true;

  await query(
    `insert into portal_permissions
       (role, module, can_edit, can_delete, updated_by)
     values ($1, $2, $3, $4, $5)
     on conflict (role, module) do update set
       can_edit = case when $6 = 'edit' then $3 else portal_permissions.can_edit end,
       can_delete = case when $6 = 'delete' then $4 else portal_permissions.can_delete end,
       updated_by = $5,
       updated_at = now()`,
    [role, module, editValue, deleteValue, session.userId, action],
  );

  return NextResponse.json({ role, module, action, allowed });
}