import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest } from "next/server";

// All queries, including real route-handler transactions, use a temporary DB.
// Never load lib/db or connect these tests to campus/student data.
let db: Pool;
let role = "admin";
vi.mock("@/lib/db", () => ({
  pool: { connect: () => db.connect(), query: (sql: string, args?: unknown[]) => db.query(sql, args) },
  query: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows,
  queryOne: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows[0] ?? null,
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => ({ session: { role, userId: "00000000-0000-4000-8000-000000000099" }, response: null }),
}));

import { runAutoStruckOff } from "../lib/auto-struck-off";
import { getCoordinatorAttendanceStandings } from "../lib/coordinator-attendance-standing";
import { getStudentAttendanceHistory } from "../lib/student-attendance-history";
import { POST as saveAttendance } from "../app/api/admin/student-attendance/roster/route";
import { GET as reportAttendance } from "../app/api/admin/student-attendance/report/route";
import { GET as shortAttendance, POST as strikeSelected } from "../app/api/admin/student-attendance/short/route";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLASS = id(1), SEMESTER = id(2), DEPARTMENT = id(3), STUDENT = id(4);
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
  dir = mkdtempSync(join(tmpdir(), "standing-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "standing_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "standing_test", database: "postgres" });
  await db.query(`
    create type student_attendance_status as enum ('present','absent','leave');
    create table departments(id uuid primary key, name text, hod_id uuid);
    create table classes(id uuid primary key, class_name text, session text, department_id uuid);
    create table semesters(id uuid primary key, class_id uuid, status text);
    create table students(id uuid primary key, class_id uuid, department_id uuid,
      name text, father_name text, roll_no text, contact text,
      status text default 'active', deleted_at timestamptz, reactivated_at timestamptz,
      status_changed_by_name text, status_change_date date, updated_at timestamptz);
    create table student_leaves(id uuid default gen_random_uuid(), student_id uuid,
      leave_type text, revoked_at timestamptz, leave_start_date date, leave_end_date date);
    create table student_attendance_records(id uuid default gen_random_uuid(), student_id uuid,
      semester_id uuid, attendance_date date, status student_attendance_status,
      reason text, call_remarks text, marked_by uuid, updated_at timestamptz,
      created_at timestamptz default now(),
      unique(student_id,attendance_date));
    create table student_course_attendance(student_id uuid, attendance_date date, status text);
    create table student_status_history(id uuid default gen_random_uuid(), student_id uuid,
      previous_status text, new_status text, reason text, triggered_by text,
      semester_id uuid references semesters, attendance_pct numeric(5,2), attendance_days int);
  `);
});
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  role = "admin";
  await db.query(`truncate student_status_history, student_attendance_records,
    student_course_attendance, student_leaves, students, semesters, classes, departments cascade;
    insert into departments values('${DEPARTMENT}', 'Test Department', null);
    insert into classes values('${CLASS}', 'Test Class', '2026', '${DEPARTMENT}');
    insert into semesters values('${SEMESTER}', '${CLASS}', 'active');
    insert into students(id,class_id,department_id,name) values('${STUDENT}','${CLASS}','${DEPARTMENT}','Test Student');`);
});

async function mark(days: number, presents = 0, start = "2026-09-01", status?: string) {
  await db.query(
    `insert into student_attendance_records(student_id,semester_id,attendance_date,status)
     select $1,$2,$3::date+n,case when $6::text is not null then $6::student_attendance_status
       when n < $5 then 'present'::student_attendance_status else 'absent'::student_attendance_status end
     from generate_series(0,$4::int-1) n`,
    [STUDENT, SEMESTER, start, days, presents, status ?? null],
  );
}
async function evaluate() {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await runAutoStruckOff({
      client, studentIds: [STUDENT], semesterId: SEMESTER, classIds: [CLASS], triggeredBy: "SYSTEM",
    });
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
const standing = async () => (await getCoordinatorAttendanceStandings(db, SEMESTER, [STUDENT]))[0];
const status = async () => (await db.query("select status from students where id=$1", [STUDENT])).rows[0].status;
const post = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

describe("coordinator/admin attendance standing", () => {
  it("strikes off below 60% on day 15 and records numeric percentage and semester", async () => {
    await mark(15, 8);
    expect((await evaluate()).struckOffIds).toEqual([STUDENT]);
    const audit = (await db.query("select * from student_status_history")).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ semester_id: SEMESTER, attendance_days: 15, attendance_pct: "53.33" });
    expect((await evaluate()).struckOffIds).toEqual([]);
    expect((await db.query("select * from student_status_history")).rows).toHaveLength(1);
  });
  it("protects the first 14 evaluable days even when class and leave records exceed 15", async () => {
    await mark(14);
    await mark(20, 0, "2026-08-01", "leave");
    expect(await standing()).toMatchObject({ is_protected: true, evaluable_days: 14, eligible_for_strike_off: false });
    expect((await evaluate()).struckOffIds).toEqual([]);
    expect(await status()).toBe("active");
  });
  it("uses 60/75 regular and 30/40 partial-leave boundaries", async () => {
    await mark(20, 12);
    expect(await standing()).toMatchObject({ flag: "warning", percentage: 60 });
    expect((await evaluate()).struckOffIds).toEqual([]);
    await db.query("update student_attendance_records set status='present' where attendance_date<'2026-09-16'");
    expect(await standing()).toMatchObject({ flag: "ok", percentage: 75 });
    await db.query("insert into student_leaves(student_id,leave_type) values($1,'partial')", [STUDENT]);
    await db.query("update student_attendance_records set status=case when attendance_date<'2026-09-09' then 'present'::student_attendance_status else 'absent'::student_attendance_status end");
    expect(await standing()).toMatchObject({ flag: "ok", percentage: 40 });
    await db.query("update student_attendance_records set status=case when attendance_date<'2026-09-07' then 'present'::student_attendance_status else 'absent'::student_attendance_status end");
    expect(await standing()).toMatchObject({ flag: "warning", percentage: 30 });
    expect((await evaluate()).struckOffIds).toEqual([]);
    await db.query("update student_attendance_records set status='absent' where attendance_date='2026-09-06'");
    expect((await evaluate()).struckOffIds).toEqual([STUDENT]);
  });
  it("resets protection after reactivation and excludes marks on the start date", async () => {
    await mark(20, 0, "2026-08-13");
    await db.query("update students set reactivated_at='2026-09-01'");
    await mark(14, 0, "2026-09-02");
    expect(await standing()).toMatchObject({ is_protected: true, evaluable_days: 14 });
    expect((await evaluate()).struckOffIds).toEqual([]);
    await mark(1, 0, "2026-09-16");
    expect((await evaluate()).struckOffIds).toEqual([STUDENT]);
  });
  it("shows protection and the reset percentage in daily attendance history", async () => {
    await mark(20, 0, "2026-08-13");
    await db.query("update students set reactivated_at='2026-09-01'");
    await mark(14, 14, "2026-09-02");
    const history = await getStudentAttendanceHistory(STUDENT, SEMESTER, null);
    expect(history[0]).toMatchObject({
      percentage: 100, is_protected: true, protection_days_completed: 14,
    });
    await mark(1, 1, "2026-09-16");
    expect((await getStudentAttendanceHistory(STUDENT, SEMESTER, null))[0]).toMatchObject({
      percentage: 100, standing: "active", is_protected: false, protection_days_completed: 15,
    });
  });
  it("does not list partial-leave warnings as strike-off candidates", async () => {
    await db.query("insert into student_leaves(student_id,leave_type) values($1,'partial')", [STUDENT]);
    await mark(20, 7);
    const response = await shortAttendance(new NextRequest(`http://localhost/api/admin/student-attendance/short?semester_id=${SEMESTER}`));
    expect((await response.json()).students).toEqual([]);
    expect(await standing()).toMatchObject({ percentage: 35, flag: "warning", eligible_for_strike_off: false });
  });
  it("ignores teacher-course marks and attendance from another class/semester", async () => {
    await mark(15, 12);
    await db.query("insert into student_course_attendance select $1,'2026-09-01'::date+n,'absent' from generate_series(0,100)n", [STUDENT]);
    expect(await standing()).toMatchObject({ percentage: 80, flag: "ok" });
    expect((await evaluate()).struckOffIds).toEqual([]);
    await db.query("update students set class_id=$1", [id(100)]);
    expect(await getCoordinatorAttendanceStandings(db, SEMESTER, [STUDENT])).toEqual([]);
    expect((await evaluate()).struckOffIds).toEqual([]);
  });
  it("serializes concurrent evaluations without duplicate status history", async () => {
    await mark(15);
    const results = await Promise.all([evaluate(), evaluate()]);
    expect(results.flatMap((result) => result.struckOffIds)).toEqual([STUDENT]);
    expect((await db.query("select * from student_status_history")).rows).toHaveLength(1);
  });
  it.each(["admin", "coordinator", "assistant"])("runs automatic standing after a %s attendance save", async (actor) => {
    role = actor;
    await mark(14);
    const response = await saveAttendance(post("/api/admin/student-attendance/roster", {
      semester_id: SEMESTER, attendance_date: "2026-09-15", rows: [{ student_id: STUDENT, status: "absent" }],
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ saved_count: 1, struck_off_count: 1 });
    expect(await status()).toBe("struck_off");
  });
  it("reports evaluation failures without rolling back saved attendance", async () => {
    await mark(14);
    await db.query("alter table student_status_history add constraint test_reject_history check(false)");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await saveAttendance(post("/api/admin/student-attendance/roster", {
        semester_id: SEMESTER, attendance_date: "2026-09-15", rows: [{ student_id: STUDENT, status: "absent" }],
      }));
      expect(await response.json()).toMatchObject({ saved_count: 1, standing_warning: expect.any(String) });
      expect((await standing()).evaluable_days).toBe(15);
      expect(await status()).toBe("active");
    } finally {
      log.mockRestore();
      await db.query("alter table student_status_history drop constraint test_reject_history");
    }
  });
  it("uses the complete current window for report standing, independent of report dates", async () => {
    await mark(15, 1);
    const response = await reportAttendance(new NextRequest(
      `http://localhost/api/admin/student-attendance/report?semester_id=${SEMESTER}&from=2026-09-01&to=2026-09-01`,
    ));
    const result = await response.json();
    expect(result.students[0]).toMatchObject({
      percentage: 100, policy_percentage: 6.67, flag: "struck_off",
      is_protected: false, eligible_for_strike_off: true,
    });
  });
  it("prevents bulk strike-off from bypassing protection and returns the actual changed count", async () => {
    await mark(14);
    const get = await shortAttendance(new NextRequest(`http://localhost/api/admin/student-attendance/short?semester_id=${SEMESTER}`));
    expect((await get.json()).students[0]).toMatchObject({ is_protected: true, eligible_for_strike_off: false });
    const response = await strikeSelected(post("/api/admin/student-attendance/short", { student_ids: [STUDENT] }));
    expect(await response.json()).toMatchObject({ struck_off_count: 0 });
    expect(await status()).toBe("active");
    await mark(1, 0, "2026-09-15");
    const after = await strikeSelected(post("/api/admin/student-attendance/short", { student_ids: [STUDENT] }));
    expect(await after.json()).toMatchObject({ struck_off_count: 1 });
  });
});