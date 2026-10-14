import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
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

interface Assistant {
  id: string;
  name: string;
  email: string;
  status: string;
}
interface AssistantPermissionRow {
  user_id: string;
  module: PortalModule;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const updateSchema = z.object({
  role: z.string().refine(isPortalManagedRole, "Invalid role."),
  module: z.string().refine(isPortalModule, "Invalid module."),
  preset: z.enum(["hidden", "read_only", "edit", "full_access", "inherit"]),
  assistantId: z.string().uuid().optional(),
}).refine((value) => !value.assistantId || value.role === "assistant", {
  message: "Individual permissions are only available for assistants.",
}).refine((value) => value.preset !== "inherit" || Boolean(value.assistantId), {
  message: "Select an assistant to restore the shared default.",
});

const presetValues: Record<PortalPreset, [boolean, boolean, boolean]> = {
  hidden: [false, false, false],
  read_only: [true, false, false],
  edit: [true, true, false],
  full_access: [true, true, true],
};

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
  const assistants = await query<Assistant>(
    `select id, name, email, status from users
     where role = 'assistant' and deleted_at is null order by name, email, id`,
  );
  const individualRows = await query<AssistantPermissionRow>(
    `select a.user_id, a.module, a.can_view, a.can_edit, a.can_delete
     from assistant_module_permissions a
     join users u on u.id = a.user_id and u.role = 'assistant' and u.deleted_at is null
     where a.module = any($1::text[])`,
    [PORTAL_MODULES.map((module) => module.key)],
  );
  const individual = new Map(individualRows.map((row) => [`${row.user_id}:${row.module}`, row]));
  const assistantPermissions = assistants.flatMap((assistant) =>
    PORTAL_MODULES.map((module) => {
      const own = individual.get(`${assistant.id}:${module.key}`);
      const effective = own ?? overrides.get(`assistant:${module.key}`);
      return {
        role: "assistant",
        assistantId: assistant.id,
        module: module.key,
        canView: effective?.can_view ?? false,
        canEdit: effective?.can_edit ?? false,
        canDelete: effective?.can_delete ?? false,
        inherited: !own,
      };
    }),
  );

  return NextResponse.json({
    roles: PORTAL_MANAGED_ROLES,
    modules: PORTAL_MODULES,
    permissions,
    assistants,
    assistantPermissions,
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

  const { role, module, preset, assistantId } = parsed.data;
  if (assistantId) {
    if (preset === "inherit") {
      // Lock the identity while removing the override; no override is already
      // inherited and should also succeed. Deleted/non-assistant IDs fail closed.
      const target = await queryOne<{ id: string }>(
        `with target as (
           select id from users where id = $1 and role = 'assistant'
             and deleted_at is null for share
         ), removed as (
           delete from assistant_module_permissions where user_id in (select id from target)
             and module = $2 returning user_id
         ) select id from target`,
        [assistantId, module],
      );
      if (!target) return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
      const fallback = await queryOne<PermissionRow>(
        `select can_view, can_edit, can_delete from portal_permissions
         where role = 'assistant' and module = $1`,
        [module],
      );
      return NextResponse.json({
        role, assistantId, module, preset, inherited: true,
        canView: fallback?.can_view ?? false,
        canEdit: fallback?.can_edit ?? false,
        canDelete: fallback?.can_delete ?? false,
      });
    }
    const [canView, canEdit, canDelete] = presetValues[preset];
    const saved = await queryOne<{ user_id: string }>(
      `insert into assistant_module_permissions
         (user_id, module, can_view, can_edit, can_delete, updated_by)
       select id, $2, $3, $4, $5, $6 from users
         where id = $1 and role = 'assistant' and deleted_at is null
       on conflict (user_id, module) do update set
         can_view = excluded.can_view, can_edit = excluded.can_edit,
         can_delete = excluded.can_delete, updated_by = excluded.updated_by, updated_at = now()
       returning user_id`,
      [assistantId, module, canView, canEdit, canDelete, session.userId],
    );
    if (!saved) return NextResponse.json({ error: "Assistant not found." }, { status: 404 });
    return NextResponse.json({ role, assistantId, module, preset, inherited: false, canView, canEdit, canDelete });
  }
  // The schema rejects "inherit" without an assistant; shared-role behavior
  // and existing clients remain unchanged.
  const [viewValue, editValue, deleteValue] = presetValues[preset as PortalPreset];

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