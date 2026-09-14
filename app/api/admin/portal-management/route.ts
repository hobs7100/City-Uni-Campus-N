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
  type PortalPreset,
} from "@/lib/portalPermissionsConfig";

interface PermissionRow {
  role: PortalManagedRole;
  module: PortalModule;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const updateSchema = z.object({
  role: z.string().refine(isPortalManagedRole, "Invalid role."),
  module: z.string().refine(isPortalModule, "Invalid module."),
  preset: z.enum(["hidden", "read_only", "edit", "full_access"]),
});

export async function GET() {
  const { response } = await requireExactRole("admin");
  if (response) return response;

  const rows = await query<PermissionRow>(
    `select role::text, module, can_view, can_edit, can_delete
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
        canView: row?.can_view ?? false,
        canEdit: row?.can_edit ?? false,
        canDelete: row?.can_delete ?? false,
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

  const { role, module, preset } = parsed.data;
  const values: Record<PortalPreset, [boolean, boolean, boolean]> = {
    hidden: [false, false, false],
    read_only: [true, false, false],
    edit: [true, true, false],
    full_access: [true, true, true],
  };
  const [viewValue, editValue, deleteValue] = values[preset];

  await query(
    `insert into portal_permissions
       (role, module, can_view, can_edit, can_delete, updated_by)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (role, module) do update set
       can_view = $3,
       can_edit = $4,
       can_delete = $5,
       updated_by = $6,
       updated_at = now()`,
    [role, module, viewValue, editValue, deleteValue, session.userId],
  );

  return NextResponse.json({
    role,
    module,
    preset,
    canView: viewValue,
    canEdit: editValue,
    canDelete: deleteValue,
  });
}