import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import type { SessionData } from "@/lib/session";

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(), query: vi.fn(), getSession: vi.fn(), getIronSession: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ queryOne: mocks.queryOne, query: mocks.query }));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession, sessionOptions: {} }));
vi.mock("iron-session", () => ({ getIronSession: mocks.getIronSession }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { DEFAULT_STUDENT_PASSWORD, DEFAULT_USER_PASSWORD, personalPasswordSchema } from "@/lib/password-policy";
import { accountTable, refreshSessionAuthentication, resetAccountToDefault, savePersonalPassword } from "@/lib/passwordSession";
import { requireExactRole, requireRole } from "@/lib/requireRole";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { POST as resetStudent } from "@/app/api/admin/students/[id]/regenerate-password/route";
import { POST as resetTeacher } from "@/app/api/admin/teachers/[id]/regenerate-password/route";
import { POST as resetUser } from "@/app/api/admin/users/[id]/regenerate-password/route";
import { middleware } from "@/middleware";

const ID = "00000000-0000-4000-8000-000000000001";
let session: SessionData & { save: ReturnType<typeof vi.fn> };
let studentHash: string, staffHash: string, personalHash: string;
const request = (path: string, body?: unknown) => new NextRequest(`http://test.local${path}`, {
  method: body === undefined ? "GET" : "POST",
  ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
});

beforeAll(async () => {
  studentHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 4);
  staffHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 4);
  personalHash = await bcrypt.hash("PersonalTestPassword!", 4);
});
beforeEach(() => {
  vi.clearAllMocks();
  session = {
    userId: ID, role: "student", name: "Test Account", email: "person@example.test",
    isLoggedIn: true, accountSource: "students", mustChangePassword: true,
    passwordVersion: 1, save: vi.fn().mockResolvedValue(undefined),
  };
  mocks.getSession.mockResolvedValue(session);
  mocks.getIronSession.mockResolvedValue(session);
  mocks.query.mockResolvedValue([]);
  mocks.queryOne.mockResolvedValue({ must_change_password: true, password_version: 1, status: "active" });
});

describe("Default-password session enforcement", () => {
  it.each(["student", "teacher", "admin", "assistant", "hod", "coordinator", "finance_manager", "suprident", "controller", "accountant"] as const)(
    "blocks pending %s accounts from protected APIs", async (role) => {
      session.role = role;
      const result = await requireRole(role);
      expect(result.response?.status).toBe(403);
      expect(await result.response!.json()).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    },
  );
  it("also blocks exact-role authorization until a personal password is chosen", async () => {
    expect((await requireExactRole("student")).response?.status).toBe(403);
  });
  it("preserves normal authorization after onboarding", async () => {
    session.mustChangePassword = false;
    expect((await requireRole("student")).response).toBeNull();
    expect((await requireExactRole("student")).response).toBeNull();
  });
  it("rechecks the database rather than trusting a stale cookie's change flag", async () => {
    session.mustChangePassword = false;
    await refreshSessionAuthentication(session);
    expect(session.mustChangePassword).toBe(true);
  });
  it("revokes previously logged-in cookies after a reset increments the version", async () => {
    mocks.queryOne.mockResolvedValue({ must_change_password: true, password_version: 2, status: "active" });
    await refreshSessionAuthentication(session);
    expect(session.isLoggedIn).toBe(false);
  });
  it("revokes legacy cookies without a password version after the all-account reset", async () => {
    delete session.passwordVersion;
    await refreshSessionAuthentication(session);
    expect(session.isLoggedIn).toBe(false);
  });
  it.each([null, { must_change_password: false, password_version: 1, status: "blocked" }])(
    "does not authenticate deleted or blocked accounts", async (row) => {
      mocks.queryOne.mockResolvedValue(row);
      await refreshSessionAuthentication(session);
      expect(session.isLoggedIn).toBe(false);
    },
  );
  it("selects the original login source even when a legacy user's role is teacher", () => {
    expect(accountTable({ role: "teacher", accountSource: "users" })).toBe("users");
    expect(accountTable({ role: "teacher" })).toBe("teachers");
    expect(accountTable({ role: "student" })).toBe("students");
    expect(accountTable({ role: "assistant" })).toBe("users");
  });
});

describe("Middleware password gate", () => {
  it.each(["/dashboard/student", "/login"])("redirects pending accounts from %s to setup", async (path) => {
    const response = await middleware(request(path));
    expect(response.headers.get("location")).toBe("http://test.local/change-password");
  });
  it.each(["/api/student/profile", "/api/upload", "/api/admin/students", "/api/ticket-attachments/private"])(
    "does not permit bypassing setup through %s", async (path) => {
      const response = await middleware(request(path));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    },
  );
  it.each(["/change-password", "/api/auth/change-password", "/api/auth/logout", "/api/auth/login"])(
    "allows onboarding and sign-out paths: %s", async (path) => {
      expect((await middleware(request(path))).status).toBe(200);
    },
  );
  it("redirects signed-out visitors away from mandatory setup", async () => {
    session.isLoggedIn = false;
    expect((await middleware(request("/change-password"))).headers.get("location")).toBe("http://test.local/login");
  });
  it("restores the same student portal after setup", async () => {
    mocks.queryOne.mockResolvedValue({ must_change_password: false, password_version: 1, status: "active" });
    expect((await middleware(request("/change-password"))).headers.get("location")).toBe("http://test.local/dashboard/student");
    expect((await middleware(request("/dashboard/student"))).status).toBe(200);
  });
  it("does not create a login redirect loop for revoked cookies", async () => {
    mocks.queryOne.mockResolvedValue({ must_change_password: true, password_version: 2, status: "active" });
    expect((await middleware(request("/dashboard/student"))).headers.get("location")).toBe("http://test.local/login");
    expect((await middleware(request("/login"))).status).toBe(200);
  });
  it("fails closed when current account state cannot be checked", async () => {
    mocks.queryOne.mockRejectedValue(new Error("Database unavailable"));
    expect((await middleware(request("/dashboard/student"))).status).toBe(503);
  });
});

describe("Login and mandatory password setup", () => {
  it.each(["users", "teachers", "students"] as const)("accepts the correct %s default and requires setup", async (source) => {
    const isStudent = source === "students";
    mocks.queryOne.mockImplementation(async (sql: string) => sql.includes(`from ${source} where email`)
      ? { id: ID, name: "Test Account", email: "person@example.test", role: isStudent ? "student" : "admin",
          status: "active", password_hash: isStudent ? studentHash : staffHash,
          must_change_password: true, password_version: 1 }
      : null);
    const response = await login(request("/api/auth/login", {
      email: "person@example.test", password: isStudent ? DEFAULT_STUDENT_PASSWORD : DEFAULT_USER_PASSWORD,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mustChangePassword: true, redirectTo: "/change-password" });
    expect(session.accountSource).toBe(source);
    expect(session.passwordVersion).toBe(1);
    expect(session.save).toHaveBeenCalledOnce();
  });
  it("stops accepting the default once a personal password is saved", async () => {
    mocks.queryOne.mockResolvedValue({
      id: ID, name: "Test Account", email: "person@example.test", role: "admin",
      status: "active", password_hash: personalHash, must_change_password: false, password_version: 2,
    });
    expect((await login(request("/api/auth/login", {
      email: "person@example.test", password: DEFAULT_USER_PASSWORD,
    }))).status).toBe(401);
    expect(session.save).not.toHaveBeenCalled();
  });
  it("continues normal personal-password login without another forced change", async () => {
    mocks.queryOne.mockResolvedValue({
      id: ID, name: "Test Account", email: "person@example.test", role: "admin",
      status: "active", password_hash: personalHash, must_change_password: false, password_version: 2,
    });
    const response = await login(request("/api/auth/login", { email: "person@example.test", password: "PersonalTestPassword!" }));
    expect(await response.json()).toMatchObject({ mustChangePassword: false, redirectTo: "/dashboard/admin" });
  });
  it.each([DEFAULT_STUDENT_PASSWORD, DEFAULT_USER_PASSWORD, "short", "🧑".repeat(19)])(
    "rejects a default, too-short or bcrypt-truncated personal password", (password) => {
      expect(personalPasswordSchema.safeParse(password).success).toBe(false);
    },
  );
  it("requires matching confirmation", async () => {
    const response = await changePassword(request("/api/auth/change-password", {
      new_password: "PersonalTestPassword!", confirm_password: "DifferentPassword!",
    }));
    expect(response.status).toBe(400);
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });
  it("requires a signed-in default-password session", async () => {
    session.isLoggedIn = false;
    expect((await changePassword(request("/api/auth/change-password", {
      new_password: "PersonalTestPassword!", confirm_password: "PersonalTestPassword!",
    }))).status).toBe(401);
  });
  it("does not replace the existing profile password-change flow", async () => {
    session.mustChangePassword = false;
    expect((await changePassword(request("/api/auth/change-password", {
      new_password: "PersonalTestPassword!", confirm_password: "PersonalTestPassword!",
    }))).status).toBe(400);
  });
  it.each(["student", "teacher", "admin", "assistant", "controller"] as const)(
    "saves a personal password and restores the existing %s home", async (role) => {
      session.role = role;
      session.accountSource = role === "student" ? "students" : role === "teacher" ? "teachers" : "users";
      mocks.queryOne.mockResolvedValue({ password_version: 2 });
      const response = await changePassword(request("/api/auth/change-password", {
        new_password: "PersonalTestPassword!", confirm_password: "PersonalTestPassword!",
      }));
      expect(response.status).toBe(200);
      const expectedHome = role === "student" ? "/dashboard/student" : role === "teacher" ? "/dashboard/teacher"
        : role === "controller" ? "/dashboard/employee" : "/dashboard/admin";
      expect(await response.json()).toMatchObject({ redirectTo: expectedHome });
      const [sql, params] = mocks.queryOne.mock.calls[0];
      expect(sql).toContain("must_change_password = false");
      expect(sql).toContain("password_version = $3");
      expect(await bcrypt.compare("PersonalTestPassword!", params[0])).toBe(true);
      expect(params.slice(1)).toEqual([ID, 1]);
      expect(session.mustChangePassword).toBe(false);
      expect(session.passwordVersion).toBe(2);
      expect(session.save).toHaveBeenCalledOnce();
    },
  );
  it("cannot overwrite a concurrent reset or another completed setup", async () => {
    mocks.queryOne.mockResolvedValue(null);
    const response = await changePassword(request("/api/auth/change-password", {
      new_password: "PersonalTestPassword!", confirm_password: "PersonalTestPassword!",
    }));
    expect(response.status).toBe(409);
    expect(session.mustChangePassword).toBe(true);
    expect(session.save).not.toHaveBeenCalled();
  });
});

describe("Default resets and existing password changes", () => {
  it.each(["users", "teachers", "students"] as const)("resets %s to the correct default and revokes sessions", async (source) => {
    mocks.queryOne.mockResolvedValue({ id: ID });
    await resetAccountToDefault(source, ID);
    const [sql, params] = mocks.queryOne.mock.calls[0];
    expect(sql).toContain(`update ${source}`);
    expect(sql).toContain("must_change_password = true");
    expect(sql).toContain("password_version = password_version + 1");
    expect(await bcrypt.compare(source === "students" ? DEFAULT_STUDENT_PASSWORD : DEFAULT_USER_PASSWORD, params[0])).toBe(true);
    expect(params[1]).toBe(ID);
  });
  it.each([resetStudent, resetTeacher, resetUser])("returns reset success without sending or exposing a password", async (reset) => {
    session.role = "admin"; session.accountSource = "users"; session.mustChangePassword = false;
    mocks.queryOne.mockResolvedValue({ id: ID });
    const response = await reset(request("/api/admin/accounts/reset", {}), { params: Promise.resolve({ id: ID }) });
    expect(await response.json()).toEqual({ success: true, mustChangePassword: true });
  });
  it("preserves the existing restriction on assistant access to user-account resets", async () => {
    session.role = "assistant"; session.mustChangePassword = false;
    const response = await resetUser(request("/api/admin/users/reset", {}), { params: Promise.resolve({ id: ID }) });
    expect(response.status).toBe(403);
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });
  it("preserves the authenticated profile flow while guarding a concurrent default reset", async () => {
    session.mustChangePassword = false;
    mocks.queryOne.mockResolvedValue({ password_version: 2 });
    await savePersonalPassword(session, personalHash);
    const [sql, params] = mocks.queryOne.mock.calls[0];
    expect(sql).toContain("must_change_password = false");
    expect(sql).toContain("password_version = $3");
    expect(params).toEqual([personalHash, ID, 1]);
  });
});
