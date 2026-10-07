import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";
let db: Pool;
let authorized = true;
vi.mock("@/lib/db", () => ({
  pool: { connect: () => db.connect(), query: (sql: string, args?: unknown[]) => db.query(sql, args) },
  query: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows,
  queryOne: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows[0] ?? null,
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => ({ session: { userId: STUDENT, role: "student" }, response: null }),
}));
vi.mock("@/lib/portalPermissions", () => ({
  requirePortalPermission: async () => authorized
    ? { session: { role: "admin", name: "Test Collector" }, response: null }
    : { session: null, response: NextResponse.json({ error: "Editing is locked" }, { status: 403 }) },
}));
import { getCurrentAttendanceFine } from "../lib/attendance-fines";
import { POST } from "../app/api/admin/fines/payment/route";
import { GET as getStudentProfile } from "../app/api/student/profile/route";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STUDENT = id(1), CLASS = id(2), SEMESTER = id(3), DEPARTMENT = id(4), CYCLE = id(5);
let dir: string;
let started = false;
beforeAll(async () => {
  const port = await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No port"));
      server.close(() => resolve(address.port));
    });
  });
  dir = mkdtempSync(join(tmpdir(), "fine-payment-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "fine_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "fine_test", database: "postgres" });
  await db.query(`
    create table departments(id uuid primary key,name text);
    create table classes(id uuid primary key,class_name text,session text);
    create table students(id uuid primary key,name text,father_name text,roll_no text,status text,
      department_id uuid,class_id uuid,deleted_at timestamptz,reactivated_at timestamptz,
      attendance_fine_cycle_id uuid,attendance_fine_cycle_started_at date,status_change_semester int);
    create table semesters(id uuid primary key,class_id uuid,semester_number int,status text,created_at timestamptz default now());
    create table student_attendance_records(student_id uuid,semester_id uuid,attendance_date date,status text);
    create table student_status_history(id uuid primary key,student_id uuid,semester_id uuid,new_status text,reason text,changed_at timestamptz default now());
    create table student_leaves(student_id uuid,leave_type text,revoked_at timestamptz);
    create table users(id uuid primary key,name text);
    create table attendance_fine_adjustments(id uuid primary key,student_id uuid,semester_id uuid,
      assessment_cycle_id uuid,adjustment_type text,discount_amount numeric,reason text,adjusted_by uuid,created_at timestamptz default now());
    create table student_fines(id uuid primary key default gen_random_uuid(),student_id uuid references students,
      department_id uuid references departments,class_id uuid references classes,semester_id uuid references semesters,
      amount numeric check(amount>=0),fid text unique,paid_date date,reactivated_on date not null,
      created_by_name text,gross_amount numeric,discount_amount numeric,adjustment_type text,assessment_cycle_id uuid);
  `);
  await db.query(readFileSync("db/migrations/063_active_student_fine_payments.sql", "utf8"));
  await db.query(`
    alter table students add column cnic text, add column contact text, add column address text,
      add column email text, add column profile_image_url text, add column status_change_date date,
      add column status_changed_by_name text, add column session text;
    alter table classes add column scheme_of_studies_url text, add column type text;
    alter table student_leaves add column partial_days_per_week int, add column created_at timestamptz default now();
  `);
});
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  authorized = true;
  await db.query(`
    truncate student_fines,attendance_fine_adjustments,student_leaves,student_status_history,student_attendance_records,
      semesters,students,classes,departments,users cascade;
    insert into departments values('${DEPARTMENT}','Computing');
    insert into classes values('${CLASS}','Test Class','2026');
    insert into students values('${STUDENT}','Test Student','Test Parent','123','active',
      '${DEPARTMENT}','${CLASS}',null,null,'${CYCLE}',null,null);
    insert into semesters(id,class_id,semester_number,status) values('${SEMESTER}','${CLASS}',1,'active');
    insert into student_attendance_records select '${STUDENT}','${SEMESTER}',date '2026-09-01'+n,
      case when n<=14 then 'present' else 'absent' end from generate_series(1,20)n;
  `);
});
async function quote() {
  const fine = await getCurrentAttendanceFine(STUDENT);
  if (!fine) throw new Error("Expected fine");
  return {
    student_id: STUDENT, semester_id: SEMESTER, assessment_cycle_id: fine.assessment_cycle_id,
    fid: "TEST-RECEIPT", paid_date: "2026-09-30",
    fine_quote: {
      presents: fine.presents, evaluable_days: fine.evaluable_days, gross_amount: fine.gross_amount,
      discount_amount: fine.discount_amount, paid_amount: fine.paid_amount, net_amount: fine.net_amount,
      adjustment_type: fine.adjustment_type, adjusted_at: fine.adjusted_at,
    },
  };
}
const pay = (data: unknown) => POST(new NextRequest("http://test/api/admin/fines/payment", {
  method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" },
}));
describe("current fine policy", () => {
  it.each(["active", "permanent_leave"])("shows %s fines outside the protection window", async (status) => {
    await db.query("update students set status=$1", [status]);
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ status, gross_amount: 500, net_amount: 500, is_protected: false });
  });
  it.each(["active", "permanent_leave"])("protects %s students before day 15, including first enrollment", async (status) => {
    await db.query("update students set status=$1", [status]);
    await db.query("delete from student_attendance_records where attendance_date>'2026-09-15';update student_attendance_records set status='absent'");
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ gross_amount: 0, is_protected: true, evaluable_days: 14 });
    await db.query(`insert into student_attendance_records values('${STUDENT}','${SEMESTER}','2026-09-16','absent')`);
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ gross_amount: 8000, is_protected: false, evaluable_days: 15 });
  });
  it("uses the same reactivation window even with a different financial cycle date", async () => {
    await db.query("update students set reactivated_at='2026-09-15',attendance_fine_cycle_started_at='2026-09-01'");
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ is_protected: true, evaluable_days: 20, protection_days_completed: 6, gross_amount: 0 });
  });
  it.each(["active", "permanent_leave"])("charges %s low overall attendance even when recent attendance recovered", async (status) => {
    await db.query("update students set status=$1,reactivated_at='2026-09-07',attendance_fine_cycle_started_at='2026-09-07'", [status]);
    await db.query(`delete from student_attendance_records;
      insert into student_attendance_records select '${STUDENT}','${SEMESTER}',date '2026-09-01'+n,
        case when n<=2 or n between 7 and 34 then 'present' else 'absent' end from generate_series(1,42)n`);
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({
      presents: 30, evaluable_days: 42, attendance_percentage: 71.43,
      protection_days_completed: 36, is_protected: false, gross_amount: 500, net_amount: 500,
    });
    const profile = await getStudentProfile(new NextRequest("http://test/api/student/profile"));
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject({ student: { attendance_fine: {
      attendance_percentage: 71.43, is_protected: false, net_amount: 500,
    } } });
    // The same 71.43% overall attendance must not produce a fine inside protection.
    await db.query("update students set reactivated_at='2026-09-29'");
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({
      attendance_percentage: 71.43, protection_days_completed: 14,
      is_protected: true, gross_amount: 0, net_amount: 0,
    });
    expect(await (await getStudentProfile(new NextRequest("http://test/api/student/profile"))).json())
      .toMatchObject({ student: { attendance_fine: { is_protected: true, gross_amount: 0, net_amount: 0 } } });
    await db.query("update students set reactivated_at='2026-09-28'");
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({
      protection_days_completed: 15, is_protected: false, gross_amount: 500,
    });
  });
  it("excludes leave days and unrelated-semester attendance", async () => {
    await db.query(`insert into student_attendance_records select '${STUDENT}','${SEMESTER}',date '2026-08-01'+n,'leave' from generate_series(1,20)n;
      insert into student_attendance_records select '${STUDENT}','${id(99)}',date '2026-08-01'+n,'absent' from generate_series(1,20)n`);
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ evaluable_days: 20, presents: 14, gross_amount: 500 });
  });
  it("honors partial-leave and the existing struck-off minimum", async () => {
    await db.query(`insert into student_leaves values('${STUDENT}','partial',null)`);
    expect(await getCurrentAttendanceFine(STUDENT)).toBeNull();
    await db.query("delete from student_leaves;update students set status='struck_off'");
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ gross_amount: 5000 });
  });
  it("preserves the durable struck-off cycle when strike-off clears the reactivation date", async () => {
    await db.query("update students set status='struck_off',reactivated_at=null,attendance_fine_cycle_started_at='2026-09-15'");
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ evaluable_days: 6, gross_amount: 8000, is_protected: false });
  });
});
describe("atomic active-student collection", () => {
  it.each(["active", "permanent_leave"])("records %s payment and clears the portal balance without reactivation", async (status) => {
    await db.query("update students set status=$1", [status]);
    const before = (await db.query("select * from students")).rows[0];
    expect((await pay(await quote())).status).toBe(200);
    expect((await db.query("select * from students")).rows[0]).toEqual(before);
    expect((await db.query("select * from student_fines")).rows[0]).toMatchObject({ amount: "500", reactivated_on: null, fid: "TEST-RECEIPT", created_by_name: "Test Collector", assessment_cycle_id: CYCLE });
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ paid_amount: 500, net_amount: 0, is_protected: false });
  });
  it("does not accept unauthorized collection", async () => {
    authorized = false;
    expect((await pay(await quote())).status).toBe(403);
    expect((await db.query("select * from student_fines")).rows).toHaveLength(0);
  });
  it("rejects stale attendance, amounts, and assessment cycles", async () => {
    const data = await quote();
    await db.query("update student_attendance_records set status='absent'");
    expect((await pay(data)).status).toBe(409);
    data.assessment_cycle_id = id(99);
    expect((await pay(data)).status).toBe(409);
    expect((await db.query("select * from student_fines")).rows).toHaveLength(0);
  });
  it("rejects stale discounts", async () => {
    const data = await quote();
    await db.query(`insert into attendance_fine_adjustments(id,student_id,semester_id,assessment_cycle_id,adjustment_type,discount_amount,reason)
      values('${id(9)}','${STUDENT}','${SEMESTER}','${CYCLE}','discount',100,'Test discount')`);
    expect((await pay(data)).status).toBe(409);
    expect((await pay(await quote())).status).toBe(200);
    expect((await db.query("select amount from student_fines")).rows[0].amount).toBe("400");
  });
  it("serializes concurrent submissions so the same balance is paid only once", async () => {
    const data = await quote();
    const results = await Promise.all([pay(data), pay({ ...data, fid: "SECOND-FID" })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await db.query("select * from student_fines")).rows).toHaveLength(1);
  });
  it("rejects reused FID and rolls back the duplicate payment", async () => {
    const data = await quote();
    await db.query(`insert into student_fines(student_id,department_id,class_id,semester_id,amount,fid,assessment_cycle_id)
      values('${STUDENT}','${DEPARTMENT}','${CLASS}','${SEMESTER}',1,'TEST-RECEIPT','${id(99)}')`);
    expect((await pay(data)).status).toBe(409);
    expect((await db.query("select * from student_fines")).rows).toHaveLength(1);
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ net_amount: 500 });
  });
  it.each(["struck_off", "alumni"])("never changes %s status through ordinary collection", async (status) => {
    const data = await quote();
    await db.query("update students set status=$1", [status]);
    expect((await pay(data)).status).toBe(409);
    expect((await db.query("select * from student_fines")).rows).toHaveLength(0);
  });
  it("rejects a quote when the student re-enters protection", async () => {
    const data = await quote();
    await db.query("update students set reactivated_at='2026-09-15'");
    expect((await pay(data)).status).toBe(409);
  });
  it("charges only a later increase after subtracting previous collections", async () => {
    expect((await pay(await quote())).status).toBe(200);
    await db.query(`insert into student_attendance_records values('${STUDENT}','${SEMESTER}','2026-09-22','absent')`);
    expect(await getCurrentAttendanceFine(STUDENT)).toMatchObject({ gross_amount: 1000, paid_amount: 500, net_amount: 500 });
  });
  it.each(["2026-02-30", "2099-01-01"])("rejects invalid or future date %s", async (paid_date) => {
    expect((await pay({ ...await quote(), paid_date })).status).toBe(400);
    expect((await db.query("select * from student_fines")).rows).toHaveLength(0);
  });
});
