import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import type { SessionData } from "@/lib/session";

let db: Pool, dir: string, started = false;
let session: SessionData & { save: ReturnType<typeof vi.fn> };
vi.mock("@/lib/db", () => ({
  queryOne: async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows[0] ?? null,
  query: async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows,
}));
vi.mock("@/lib/session", () => ({ getSession: async () => session }));
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { refreshSessionAuthentication, resetAccountToDefault, savePersonalPassword } from "@/lib/passwordSession";
import { DEFAULT_STUDENT_PASSWORD, DEFAULT_USER_PASSWORD } from "@/lib/password-policy";

const ID = "00000000-0000-4000-8000-000000000001";
const passwordRequest = () => new NextRequest("http://test.local/api/auth/change-password", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ new_password: "PersonalTestPassword!", confirm_password: "PersonalTestPassword!" }),
});
beforeAll(async () => {
  const port = await new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      server.close(() => resolve(address.port));
    });
  });
  dir = mkdtempSync(join(tmpdir(), "password-test-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "password_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "password_test", database: "postgres" });
  await db.query("create type student_status as enum ('active','struck_off','left','dropped','freezed','permanent_leave','alumni')");
  for (const table of ["users", "teachers", "students"]) {
    await db.query(`create table ${table} (
      id uuid primary key, password_hash text not null,
      status ${table === "students" ? "student_status" : "text"} not null default 'active',
      deleted_at timestamptz, updated_at timestamptz default now()
    )`);
  }
  await db.query(readFileSync(join(process.cwd(), "db/migrations/064_mandatory_password_change.sql"), "utf8"));
});
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await db.query("truncate users, teachers, students");
  const studentHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 4);
  const staffHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 4);
  for (const table of ["users", "teachers", "students"]) {
    await db.query(`insert into ${table}(id,password_hash) values($1,$2)`,
      [ID, table === "students" ? studentHash : staffHash]);
  }
  session = {
    userId: ID, name: "Test Account", email: "person@example.test", role: "student", accountSource: "students",
    isLoggedIn: true, mustChangePassword: true, passwordVersion: 0, save: vi.fn().mockResolvedValue(undefined),
  };
});

it.each(["users", "teachers", "students"] as const)("the actual migration forces newly inserted %s to choose a password", async (source) => {
  const row = (await db.query(`select must_change_password,password_version from ${source} where id=$1`, [ID])).rows[0];
  expect(row).toEqual({ must_change_password: true, password_version: 0 });
});

it.each(["users", "teachers", "students"] as const)("completes setup against real %s SQL, including the student enum", async (source) => {
  session.accountSource = source;
  session.role = source === "students" ? "student" : source === "teachers" ? "teacher" : "admin";
  const response = await changePassword(passwordRequest());
  expect(response.status).toBe(200);
  const row = (await db.query(`select password_hash,must_change_password,password_version from ${source} where id=$1`, [ID])).rows[0];
  expect(row.must_change_password).toBe(false);
  expect(row.password_version).toBe(1);
  expect(await bcrypt.compare("PersonalTestPassword!", row.password_hash)).toBe(true);
  expect(await bcrypt.compare(source === "students" ? DEFAULT_STUDENT_PASSWORD : DEFAULT_USER_PASSWORD, row.password_hash)).toBe(false);
  expect(session.save).toHaveBeenCalledOnce();
});

it("resetting a completed account restores the default, forces setup and invalidates its prior cookie", async () => {
  expect((await changePassword(passwordRequest())).status).toBe(200);
  await resetAccountToDefault("students", ID);
  await refreshSessionAuthentication(session);
  expect(session.isLoggedIn).toBe(false);
  const row = (await db.query("select password_hash,must_change_password,password_version from students where id=$1", [ID])).rows[0];
  expect(row.must_change_password).toBe(true);
  expect(row.password_version).toBe(2);
  expect(await bcrypt.compare(DEFAULT_STUDENT_PASSWORD, row.password_hash)).toBe(true);
});

it("an already-reset session cannot complete setup or bypass it with a profile password change", async () => {
  await resetAccountToDefault("students", ID);
  expect((await changePassword(passwordRequest())).status).toBe(409);
  expect(await savePersonalPassword(session, await bcrypt.hash("PersonalTestPassword!", 4))).toBeNull();
  const row = (await db.query("select must_change_password,password_version from students where id=$1", [ID])).rows[0];
  expect(row).toEqual({ must_change_password: true, password_version: 1 });
});

it("a second default-password session cannot overwrite an already-completed setup", async () => {
  expect((await changePassword(passwordRequest())).status).toBe(200);
  session.mustChangePassword = true;
  session.passwordVersion = 0;
  expect((await changePassword(passwordRequest())).status).toBe(409);
  expect(session.save).toHaveBeenCalledOnce();
});

it("the existing profile password change remains available after mandatory setup", async () => {
  expect((await changePassword(passwordRequest())).status).toBe(200);
  const saved = await savePersonalPassword(session, await bcrypt.hash("AnotherPersonalTest!", 4));
  expect(saved?.password_version).toBe(2);
});
