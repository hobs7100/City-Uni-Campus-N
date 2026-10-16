import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import type { SessionData } from "@/lib/session";

let db: Pool, dir: string, started = false;
let session: SessionData & { save: ReturnType<typeof vi.fn> };
vi.mock("@/lib/db", () => ({
  getClient: () => db.connect(),
  pool: { connect: () => db.connect() },
  queryOne: async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows[0] ?? null,
  query: async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows,
}));
vi.mock("@/lib/session", () => ({ getSession: async () => session }));
vi.mock("@/lib/portalPermissions", () => ({
  requirePortalPermission: async () => ({ session: { role: "admin", userId: ID }, response: null }),
}));
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as createStudent } from "@/app/api/admin/students/route";
import { POST as importStudents } from "@/app/api/admin/students/bulk/route";
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
      name text, email text, deleted_at timestamptz, updated_at timestamptz default now()
    )`);
  }
  await db.query(`alter table users add column role text default 'admin';
    alter table students alter column id set default gen_random_uuid();
    alter table students add column father_name text, add column cnic text,
      add column contact text, add column address text, add column department_id uuid,
      add column session text, add column class_id uuid, add column profile_image_url text,
      add column status_change_date date, add column status_change_semester int, add column roll_no text;
    create table classes (id uuid primary key, department_id uuid, class_name text, type text, session text);
    create table departments (id uuid primary key, name text, deleted_at timestamptz);
    create table login_activity (actor_type text,actor_id uuid,email text,ip_address text,user_agent text);
    insert into departments values ('00000000-0000-4000-8000-000000000002','English',null);
    insert into classes values ('00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002','BS English','BS','2026-30');`);
  await db.query(readFileSync(join(process.cwd(), "db/migrations/064_mandatory_password_change.sql"), "utf8"));
});
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await db.query("truncate users, teachers, students, login_activity");
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

const loginRequest = (email: string) => new NextRequest("http://test.local/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: DEFAULT_STUDENT_PASSWORD }),
});

it("single-student creation saves a normalized email, the correct default and mandatory setup", async () => {
  const result = await createStudent(new NextRequest("http://test.local/api/admin/students", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "New Student", cnic: "12345-1234567-1", email: "  NEW.STUDENT@EXAMPLE.TEST  ",
      department_id: "00000000-0000-4000-8000-000000000002", class_id: "00000000-0000-4000-8000-000000000003",
      session: "2026-30" }),
  }));
  expect(result.status).toBe(201);
  const student = (await result.json()).student;
  expect(student.email).toBe("new.student@example.test");
  const record = (await db.query("select password_hash,must_change_password from students where id=$1", [student.id])).rows[0];
  expect(await bcrypt.compare(DEFAULT_STUDENT_PASSWORD, record.password_hash)).toBe(true);
  expect(record.must_change_password).toBe(true);
  const authenticated = await login(loginRequest(" NEW.STUDENT@EXAMPLE.TEST "));
  expect(authenticated.status).toBe(200);
  expect(await authenticated.json()).toMatchObject({ mustChangePassword: true, redirectTo: "/change-password" });
  expect(session.userId).toBe(student.id);
  // Duplicate checking uses the normalized address as well.
  const duplicate = await createStudent(new NextRequest("http://test.local/api/admin/students", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Other Student", cnic: "54321-7654321-1", email: "New.Student@Example.Test ",
      department_id: "00000000-0000-4000-8000-000000000002", class_id: "00000000-0000-4000-8000-000000000003",
      session: "2026-30" }),
  }));
  expect(duplicate.status).toBe(409);
});

it("spreadsheet imports reject unusable email addresses and provision valid students for default login", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { name: "Invalid Student", email: "not-an-email", cnic: "11111", department_name: "English", class_name: "BS English", session: "2026-30" },
    { name: "Valid Student", email: " IMPORTED@EXAMPLE.TEST ", cnic: "22222", department_name: "English", class_name: "BS English", session: "2026-30" },
  ]), "Students");
  const form = new FormData();
  form.set("file", new File([XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })], "students.xlsx"));
  const result = await importStudents(new NextRequest("http://test.local/api/admin/students/bulk", { method: "POST", body: form }));
  expect(result.status).toBe(200);
  const body = await result.json();
  expect(body.created).toBe(1);
  expect(body.errors).toEqual([expect.stringContaining("email must be a valid email address")]);
  const record = (await db.query("select password_hash,must_change_password from students where email=$1", ["imported@example.test"])).rows[0];
  expect(await bcrypt.compare(DEFAULT_STUDENT_PASSWORD, record.password_hash)).toBe(true);
  expect(record.must_change_password).toBe(true);
  expect((await login(loginRequest("\tImported@Example.Test\n"))).status).toBe(200);
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
