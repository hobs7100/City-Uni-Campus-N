import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import type { SessionData } from "@/lib/session";

let db: Pool, dir: string, started = false;
let session: SessionData;
let requestHeaders = new Headers();
const cloud = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@/lib/db", () => ({
  queryOne: async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows[0] ?? null,
  query: async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows,
}));
vi.mock("@/lib/session", () => ({ getSession: async () => session, sessionOptions: {} }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("iron-session", () => ({ getIronSession: async () => session }));
vi.mock("@/lib/cloudinary", () => ({ uploadToCloudinary: cloud.upload }));
import { GET, PATCH } from "@/app/api/admin/portal-management/route";
import { GET as portalAccess } from "@/app/api/portal-access/route";
import { POST as upload } from "@/app/api/upload/route";
import { getPortalAccess, getPortalAccessMap, requirePortalPermission } from "@/lib/portalPermissions";
import { getDashboardNavigation } from "@/lib/nav";
import { requireRole } from "@/lib/requireRole";
import { middleware } from "@/middleware";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const A = "00000000-0000-4000-8000-000000000002";
const B = "00000000-0000-4000-8000-000000000003";
const OTHER = "00000000-0000-4000-8000-000000000004";
const req = (body: unknown) => new NextRequest("http://test.local/api/admin/portal-management", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
function signIn(id = A, role: SessionData["role"] = "assistant") {
  session = { userId: id, role, name: "Fixture", email: "fixture@example.test", isLoggedIn: true,
    accountSource: "users", mustChangePassword: false, passwordVersion: 0 };
}
async function setOwn(id: string, module: string, preset: string) {
  return PATCH(req({ role: "assistant", assistantId: id, module, preset }));
}
function context(module: string, action = "view", parents = "") {
  requestHeaders = new Headers({
    "x-portal-target-module": module, "x-portal-action": action, "x-portal-read-parents": parents,
  });
}

beforeAll(async () => {
  const port = await new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      server.close(() => resolve(address.port));
    });
  });
  dir = mkdtempSync(join(tmpdir(), "assistant-policy-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "assistant_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "assistant_test", database: "postgres" });
  await db.query(`create type user_role as enum ('admin','assistant','hod','coordinator','finance_manager');
    create table users (
      id uuid primary key, name text, email text, role user_role, status text default 'active',
      deleted_at timestamptz, must_change_password boolean default false, password_version int default 0
    );
    create table portal_permissions (
      role user_role, module varchar(50), can_view boolean, can_edit boolean, can_delete boolean,
      updated_by uuid references users(id), updated_at timestamptz default now(), primary key(role,module)
    )`);
  await db.query(readFileSync(join(process.cwd(), "db/migrations/065_assistant_module_permissions.sql"), "utf8"));
}, 90000);
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  requestHeaders = new Headers();
  vi.clearAllMocks();
  await db.query("truncate users,portal_permissions cascade");
  for (const [id, role] of [[ADMIN, "admin"], [A, "assistant"], [B, "assistant"], [OTHER, "coordinator"]]) {
    await db.query("insert into users(id,name,email,role) values($1,'Fixture',$2,$3)", [id, `${id}@example.test`, role]);
  }
  for (const role of ["assistant", "coordinator", "hod", "finance_manager"]) {
    await db.query(`insert into portal_permissions(role,module,can_view,can_edit,can_delete)
      values($1,'students',true,true,true),($1,'classes',true,false,false)`, [role]);
  }
  signIn(ADMIN, "admin");
});

describe("Individual module controls", () => {
  it("preserves shared defaults for existing and newly-created assistants without seeding overrides", async () => {
    expect(await getPortalAccess("assistant", "students", A)).toEqual({ canView: true, canEdit: true, canDelete: true });
    expect(await getPortalAccess("assistant", "students", B)).toEqual({ canView: true, canEdit: true, canDelete: true });
    expect((await db.query("select * from assistant_module_permissions")).rows).toEqual([]);
  });
  it.each([
    ["hidden", false, false, false], ["read_only", true, false, false],
    ["edit", true, true, false], ["full_access", true, true, true],
  ] as const)("applies %s only to the selected assistant and module", async (preset, canView, canEdit, canDelete) => {
    const response = await setOwn(A, "students", preset);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ assistantId: A, inherited: false, canView, canEdit, canDelete });
    expect(await getPortalAccess("assistant", "students", A)).toEqual({ canView, canEdit, canDelete });
    expect(await getPortalAccess("assistant", "students", B)).toEqual({ canView: true, canEdit: true, canDelete: true });
    expect(await getPortalAccess("assistant", "classes", A)).toEqual({ canView: true, canEdit: false, canDelete: false });
    for (const role of ["coordinator", "hod", "finance_manager"] as const) {
      expect(await getPortalAccess(role, "students", OTHER)).toEqual({ canView: true, canEdit: true, canDelete: true });
    }
  });
  it("can grant an individual module even if the role default is absent", async () => {
    expect(await getPortalAccess("assistant", "fines", A)).toEqual({ canView: false, canEdit: false, canDelete: false });
    await setOwn(A, "fines", "edit");
    expect(await getPortalAccess("assistant", "fines", A)).toEqual({ canView: true, canEdit: true, canDelete: false });
    expect((await getPortalAccess("assistant", "fines", B)).canView).toBe(false);
  });
  it("returns named assistants and effective/inherited permissions for all modules", async () => {
    await setOwn(A, "students", "hidden");
    const data = await (await GET()).json();
    expect(data.assistants.map((a: { id: string }) => a.id).sort()).toEqual([A, B]);
    expect(data.assistantPermissions.find((p: { assistantId: string; module: string }) => p.assistantId === A && p.module === "students"))
      .toMatchObject({ canView: false, inherited: false });
    expect(data.assistantPermissions.find((p: { assistantId: string; module: string }) => p.assistantId === B && p.module === "students"))
      .toMatchObject({ canView: true, inherited: true });
  });
  it("restores defaults by removing only the selected module override", async () => {
    await setOwn(A, "students", "hidden");
    await setOwn(A, "classes", "hidden");
    await setOwn(B, "students", "read_only");
    const response = await setOwn(A, "students", "inherit");
    expect(await response.json()).toMatchObject({ inherited: true, canView: true, canEdit: true, canDelete: true });
    expect((await getPortalAccess("assistant", "classes", A)).canView).toBe(false);
    expect((await getPortalAccess("assistant", "students", B)).canEdit).toBe(false);
    expect((await setOwn(A, "students", "inherit")).status).toBe(200);
  });
  it("changes shared defaults only for inheriting assistants, not explicit overrides", async () => {
    await setOwn(A, "students", "read_only");
    expect((await PATCH(req({ role: "assistant", module: "students", preset: "hidden" }))).status).toBe(200);
    expect((await getPortalAccess("assistant", "students", B)).canView).toBe(false);
    expect(await getPortalAccess("assistant", "students", A)).toEqual({ canView: true, canEdit: false, canDelete: false });
  });
  it("maintains a single audited override across repeated edits", async () => {
    await setOwn(A, "students", "hidden");
    await setOwn(A, "students", "edit");
    const rows = (await db.query("select * from assistant_module_permissions")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: A, module: "students", updated_by: ADMIN, can_edit: true });
  });
});

describe("Authorization and permission isolation", () => {
  it.each([A, OTHER])("never allows a non-admin to view or modify assistant permissions", async (id) => {
    signIn(id, id === A ? "assistant" : "coordinator");
    expect((await GET()).status).toBe(403);
    expect((await setOwn(B, "students", "full_access")).status).toBe(403);
    expect((await db.query("select * from assistant_module_permissions")).rows).toHaveLength(0);
  });
  it.each([ADMIN, OTHER, "00000000-0000-4000-8000-000000000099"])(
    "rejects overrides and inheritance resets for non-assistant or nonexistent IDs", async (id) => {
      expect((await setOwn(id, "students", "full_access")).status).toBe(404);
      expect((await setOwn(id, "students", "inherit")).status).toBe(404);
    },
  );
  it("ignores and rejects deleted assistants while allowing admins to preconfigure blocked assistants", async () => {
    await db.query("update users set deleted_at=now() where id=$1", [A]);
    expect((await setOwn(A, "students", "hidden")).status).toBe(404);
    expect((await getPortalAccess("assistant", "students", A)).canView).toBe(false);
    await db.query("update users set status='blocked' where id=$1", [B]);
    expect((await setOwn(B, "students", "edit")).status).toBe(200);
    expect((await getPortalAccess("assistant", "students", B)).canView).toBe(false);
  });
  it.each([
    { role: "assistant", assistantId: "invalid", module: "students", preset: "edit" },
    { role: "coordinator", assistantId: A, module: "students", preset: "edit" },
    { role: "assistant", assistantId: A, module: "unknown", preset: "edit" },
    { role: "assistant", assistantId: A, module: "students", preset: "unknown" },
    { role: "assistant", module: "students", preset: "inherit" },
    { role: "admin", module: "students", preset: "hidden" },
  ])("rejects invalid or ambiguous permission mutations", async (body) => {
    expect((await PATCH(req(body))).status).toBe(400);
  });
  it("fails closed if assistant identity is missing or is not an active assistant", async () => {
    expect((await getPortalAccess("assistant", "students")).canView).toBe(false);
    expect((await getPortalAccess("assistant", "students", OTHER)).canView).toBe(false);
  });
  it("never restricts the administrator", async () => {
    await setOwn(A, "students", "hidden");
    expect(await getPortalAccess("admin", "students", ADMIN)).toEqual({ canView: true, canEdit: true, canDelete: true });
    expect((await requirePortalPermission("students", "delete", "admin")).response).toBeNull();
  });
  it("hides denied navigation and returns each assistant's own capabilities", async () => {
    await setOwn(A, "students", "hidden");
    expect((await getDashboardNavigation("assistant", A)).some((item) => item.href === "/dashboard/admin/students")).toBe(false);
    expect((await getDashboardNavigation("assistant", B)).some((item) => item.href === "/dashboard/admin/students")).toBe(true);
    expect((await getPortalAccessMap("assistant", A)).get("students")?.canView).toBe(false);
    signIn(A);
    expect(await (await portalAccess(new NextRequest("http://test.local/api/portal-access?module=students"))).json())
      .toEqual({ canView: false, canEdit: false, canDelete: false });
  });
  it.each(["edit", "delete"])("read-only access denies %s at the server while preserving viewing", async (action) => {
    await setOwn(A, "students", "read_only");
    signIn(A);
    context("students");
    expect((await requireRole("admin")).response).toBeNull();
    context("students", action);
    expect((await requireRole("admin")).response?.status).toBe(403);
    expect((await requirePortalPermission("students", action as "edit" | "delete", "admin")).response?.status).toBe(403);
  });
  it("uses only the same assistant's read dependencies and never grants dependency mutations", async () => {
    await setOwn(A, "students", "hidden");
    await setOwn(A, "fines", "read_only");
    signIn(A);
    context("students", "view", "fines");
    expect((await requireRole("admin")).response).toBeNull();
    context("students", "edit", "fines");
    expect((await requireRole("admin")).response?.status).toBe(403);
    signIn(B);
    context("fines");
    expect((await requireRole("admin")).response?.status).toBe(403);
  });
  it("revokes an existing assistant's direct API access immediately without a new login", async () => {
    signIn(A); context("students");
    expect((await requireRole("admin")).response).toBeNull();
    signIn(ADMIN, "admin"); requestHeaders = new Headers();
    await setOwn(A, "students", "hidden");
    signIn(A); context("students");
    expect((await requireRole("admin")).response?.status).toBe(403);
  });
  it("uses individual edit rights for uploads without affecting another assistant", async () => {
    await setOwn(A, "students", "read_only");
    cloud.upload.mockResolvedValue({ url: "https://example.test/image.png" });
    const makeRequest = () => new NextRequest("http://test.local/api/upload", {
      method: "POST", body: JSON.stringify({ folder: "students", file: "data:image/png;base64,AA==" }),
    });
    signIn(A);
    expect((await upload(makeRequest())).status).toBe(403);
    expect(cloud.upload).not.toHaveBeenCalled();
    signIn(B);
    expect((await upload(makeRequest())).status).toBe(200);
    expect(cloud.upload).toHaveBeenCalledOnce();
  });
  it("blocks direct page URLs and strips spoofed module grants before API authorization", async () => {
    await setOwn(A, "students", "hidden");
    signIn(A);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      portalAccess(new NextRequest("http://test.local/api/portal-access?module=students")));
    try {
      expect((await middleware(new NextRequest("http://test.local/dashboard/admin/students"))).headers.get("location"))
        .toBe("http://test.local/dashboard/admin");
      const response = await middleware(new NextRequest("http://test.local/api/admin/students", {
        headers: { "x-portal-module-grant": "admin", "x-portal-target-module": "classes", "x-portal-action": "edit" },
      }));
      expect(response.headers.get("x-middleware-request-x-portal-target-module")).toBe("students");
      expect(response.headers.get("x-middleware-request-x-portal-module-grant")).toBeNull();
    } finally { fetchMock.mockRestore(); }
  });
  it("enforces coherent view/edit/delete rights in the database", async () => {
    await expect(db.query(`insert into assistant_module_permissions(user_id,module,can_view,can_edit,can_delete)
      values($1,'students',false,true,false)`, [A])).rejects.toMatchObject({ code: "23514" });
  });
});
