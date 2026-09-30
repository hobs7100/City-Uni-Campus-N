import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool, type PoolClient } from "pg";
import { NextRequest } from "next/server";

// Import the actual handlers, but force *all* database access into the temporary
// local cluster. Never import the production lib/db module or use its URL.
let routePool: Pool;
vi.mock("@/lib/db", () => ({
  pool: { connect: () => routePool.connect() },
  query: async (sql: string, params?: unknown[]) => (await routePool.query(sql, params)).rows,
  queryOne: async (sql: string, params?: unknown[]) => (await routePool.query(sql, params)).rows[0] ?? null,
}));
const TEACHER = "00000000-0000-4000-8000-000000000001";
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => ({ session: { userId: TEACHER }, response: null }),
}));

import { GET as slotsGET } from "../app/api/teacher/student-attendance/slots/route";
import { GET as rosterGET, POST as rosterPOST } from "../app/api/teacher/student-attendance/roster/route";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ALLOCATION = id(2), COURSE = id(3), CLASS_A = id(4), CLASS_B = id(5);
const SEM_A = id(6), SEM_B = id(7), STUDENT_A = id(8), STUDENT_B = id(9);
const DATE = "2026-09-28"; // Monday
const FIRST = { start_time: "09:00:00", end_time: "10:00:00" };
const SECOND = { start_time: "11:00:00", end_time: "12:00:00" };
let dir: string;
let port: number;
let admin: Pool;
let started = false;

function getRequest(path: string, slot = FIRST) {
  return new NextRequest(`http://localhost/api/teacher/student-attendance/${path}?` +
    new URLSearchParams({ allocation_id: ALLOCATION, date: DATE, ...slot }));
}
function postRequest(rows: { student_id: string; status: string }[], slot = FIRST) {
  return new NextRequest("http://localhost/api/teacher/student-attendance/roster", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ allocation_id: ALLOCATION, attendance_date: DATE, ...slot, rows }),
  });
}
const both = [
  { student_id: STUDENT_A, status: "absent" },
  { student_id: STUDENT_B, status: "present" },
];

async function json(response: Response, status: number) {
  expect(response.status).toBe(status);
  return response.json();
}

async function seed() {
  await admin.query(`
    insert into allocations values ('${ALLOCATION}', '${TEACHER}', '${COURSE}', 'active', true);
    insert into classes values ('${CLASS_A}', 'Class A', '2026'), ('${CLASS_B}', 'Class B', '2026');
    insert into semesters values ('${SEM_A}', '${CLASS_A}', 'active'), ('${SEM_B}', '${CLASS_B}', 'active');
    insert into semester_courses (semester_id, course_id) values ('${SEM_A}', '${COURSE}'), ('${SEM_B}', '${COURSE}');
    insert into allocation_semesters values
      ('${id(10)}', '${ALLOCATION}', '${SEM_A}', '${COURSE}'),
      ('${id(11)}', '${ALLOCATION}', '${SEM_B}', '${COURSE}');
    insert into timetables values ('${id(12)}', '${SEM_A}');
    insert into timetable_days values ('${id(13)}', '${id(12)}', 'Monday');
    insert into timetable_periods values
      ('${id(14)}', '${id(12)}', '09:00', '10:00'),
      ('${id(15)}', '${id(12)}', '11:00', '12:00');
    insert into timetable_cells values ('${id(16)}', '${id(12)}', '${id(13)}', '${id(14)}', '${ALLOCATION}');
    insert into students (id, class_id, name, roll_no) values
      ('${STUDENT_A}', '${CLASS_A}', 'Student A', '1'),
      ('${STUDENT_B}', '${CLASS_B}', 'Student B', '2');
  `);
}

async function stored() {
  return (await admin.query(`select sca.allocation_id, sca.student_id, st.class_id,
    sca.attendance_date::text as attendance_date, sca.start_time::text as start_time,
    sca.end_time::text as end_time, sca.status, sca.marked_by
    from student_course_attendance sca join students st on st.id = sca.student_id
    order by sca.start_time, sca.student_id`)).rows;
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const value = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return value;
}

async function waitForBlockedQuery() {
  for (let i = 0; i < 100; i++) {
    const { rows } = await admin.query(`select 1 from pg_stat_activity
      where application_name = 'attendance_route_test' and wait_event_type = 'Lock'`);
    if (rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Attendance save did not wait on the competing write");
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "attendance-pg-"));
  port = await freePort();
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "attendance_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  const config = { host: "127.0.0.1", port, user: "attendance_test", database: "postgres" };
  admin = new Pool(config);
  routePool = new Pool({ ...config, application_name: "attendance_route_test" });
  await admin.query(readFileSync(join(process.cwd(), "tests/teacher-attendance-schema.sql"), "utf8"));
});
afterAll(async () => {
  await routePool?.end();
  await admin?.end();
  if (dir) {
    if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(dir, { recursive: true, force: true });
  }
});
beforeEach(async () => {
  await admin.query(`truncate student_course_attendance, student_attendance_records,
    student_leaves, students, timetable_cells, timetable_periods, timetable_days,
    timetables, allocation_semesters, semester_courses, semesters, classes, allocations cascade`);
  await seed();
});

describe("combined teacher attendance routes (isolated PostgreSQL)", () => {
  it("lists the single anchor's slot and both linked classes' students", async () => {
    expect(await json(await slotsGET(getRequest("slots")), 200)).toEqual({
      is_combined: true, slots: [FIRST],
    });
    const roster = await json(await rosterGET(getRequest("roster")), 200);
    expect(roster.is_combined).toBe(true);
    expect(roster.excluded_classes).toEqual([]);
    expect(roster.rows.map((row: { student_id: string; class_name: string }) =>
      [row.student_id, row.class_name])).toEqual([[STUDENT_A, "Class A"], [STUDENT_B, "Class B"]]);
  });

  it("rejects a combined allocation missing its second class link on read and save", async () => {
    await admin.query("delete from allocation_semesters where semester_id = $1", [SEM_B]);
    expect((await json(await rosterGET(getRequest("roster")), 409)).error).toMatch(/missing a linked class/);
    expect((await json(await rosterPOST(postRequest([both[0]])), 409)).error).toMatch(/missing a linked class/);
    expect(await stored()).toEqual([]);
  });

  it("excludes a completed leg while keeping the unfinished leg markable", async () => {
    await admin.query("update semester_courses set syllabus_completed_at = now() where semester_id = $1", [SEM_B]);
    expect((await json(await slotsGET(getRequest("slots")), 200)).slots).toEqual([FIRST]);
    const roster = await json(await rosterGET(getRequest("roster")), 200);
    expect(roster.rows.map((row: { student_id: string }) => row.student_id)).toEqual([STUDENT_A]);
    expect(roster.excluded_classes).toEqual([{
      class_name: "Class B", session: "2026", reason: "syllabus is marked complete",
    }]);
    expect(await json(await rosterPOST(postRequest([both[0]])), 200)).toEqual({ success: true });
    expect((await stored()).map((row) => row.student_id)).toEqual([STUDENT_A]);
  });

  it("still uses a completed anchor's slot for the other unfinished linked class", async () => {
    await admin.query("update semester_courses set syllabus_completed_at = now() where semester_id = $1", [SEM_A]);
    expect((await json(await slotsGET(getRequest("slots")), 200)).slots).toEqual([FIRST]);
    const roster = await json(await rosterGET(getRequest("roster")), 200);
    expect(roster.rows.map((row: { student_id: string }) => row.student_id)).toEqual([STUDENT_B]);
    expect(roster.excluded_classes).toEqual([{
      class_name: "Class A", session: "2026", reason: "syllabus is marked complete",
    }]);
    expect(await json(await rosterPOST(postRequest([both[1]])), 200)).toEqual({ success: true });
    expect((await stored()).map((row) => row.student_id)).toEqual([STUDENT_B]);
  });

  it("keeps two same-date slots independent and persists both classes under the allocation/date/slot", async () => {
    await admin.query(`insert into timetable_cells values ($1, $2, $3, $4, $5)`,
      [id(17), id(12), id(13), id(15), ALLOCATION]);
    expect((await json(await slotsGET(getRequest("slots")), 200)).slots).toEqual([FIRST, SECOND]);
    expect((await json(await rosterGET(getRequest("roster", SECOND)), 200)).rows).toHaveLength(2);
    expect(await json(await rosterPOST(postRequest(both)), 200)).toEqual({ success: true });
    expect(await json(await rosterPOST(postRequest([
      { student_id: STUDENT_A, status: "present" },
      { student_id: STUDENT_B, status: "absent" },
    ], SECOND)), 200)).toEqual({ success: true });
    const rows = await stored();
    expect(rows).toHaveLength(4);
    expect(rows.map(({ allocation_id, student_id, class_id, attendance_date, start_time, end_time, status, marked_by }) =>
      [allocation_id, student_id, class_id, attendance_date, start_time, end_time, status, marked_by])).toEqual([
      [ALLOCATION, STUDENT_A, CLASS_A, DATE, FIRST.start_time, FIRST.end_time, "absent", TEACHER],
      [ALLOCATION, STUDENT_B, CLASS_B, DATE, FIRST.start_time, FIRST.end_time, "present", TEACHER],
      [ALLOCATION, STUDENT_A, CLASS_A, DATE, SECOND.start_time, SECOND.end_time, "present", TEACHER],
      [ALLOCATION, STUDENT_B, CLASS_B, DATE, SECOND.start_time, SECOND.end_time, "absent", TEACHER],
    ]);
    expect((await json(await rosterGET(getRequest("roster")), 200)).rows.map(
      (row: { status: string }) => row.status)).toEqual(["absent", "present"]);
    expect((await json(await rosterGET(getRequest("roster", SECOND)), 200)).rows.map(
      (row: { status: string }) => row.status)).toEqual(["present", "absent"]);
  });

  it("rejects an incomplete one-class save without partially writing", async () => {
    expect((await json(await rosterPOST(postRequest([both[0]])), 409)).error).toMatch(/every included class/);
    expect(await stored()).toEqual([]);
  });

  it("rejects a transfer committed while the save waits on the allocation lock", async () => {
    const writer = await admin.connect();
    try {
      await writer.query("begin");
      await writer.query("update allocations set status = 'transferred' where id = $1", [ALLOCATION]);
      const pending = rosterPOST(postRequest(both));
      await waitForBlockedQuery();
      await writer.query("commit");
      expect((await json(await pending, 403)).error).toMatch(/no longer allocated/);
      expect(await stored()).toEqual([]);
    } finally {
      await writer.query("rollback");
      writer.release();
    }
  });

  it("rejects leave issued while the save waits on the student's row lock", async () => {
    const writer: PoolClient = await admin.connect();
    try {
      await writer.query("begin");
      await writer.query("update students set name = name where id = $1", [STUDENT_B]);
      const pending = rosterPOST(postRequest(both));
      await waitForBlockedQuery();
      await writer.query(`insert into student_leaves values ($1, $2, 'monthly', $3, $3, null)`,
        [id(18), STUDENT_B, DATE]);
      await writer.query("commit");
      expect((await json(await pending, 409)).error).toMatch(/roster has changed/);
      expect(await stored()).toEqual([]);
    } finally {
      await writer.query("rollback");
      writer.release();
    }
  });
});