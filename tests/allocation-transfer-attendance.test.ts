import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest } from "next/server";

let db: Pool;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
vi.mock("@/lib/db", () => ({
  pool: { connect: () => db.connect() },
  query: async (sql: string, values?: unknown[]) => (await db.query(sql, values)).rows,
  queryOne: async (sql: string, values?: unknown[]) => (await db.query(sql, values)).rows[0] ?? null,
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => ({ session: { userId: "00000000-0000-4000-8000-000000000002" }, response: null }),
}));
vi.mock("@/lib/portalPermissions", () => ({
  requirePortalPermission: async () => ({ response: null }),
}));
import { POST as transfer } from "../app/api/admin/allocations/[id]/transfer/route";
import { PATCH as place } from "../app/api/admin/timetables/[id]/cells/[cellId]/route";
import { GET as slots } from "../app/api/teacher/student-attendance/slots/route";
import { GET as roster, POST as saveRoster } from "../app/api/teacher/student-attendance/roster/route";

const migration = readFileSync("db/migrations/067_transferred_allocation_timetable_links.sql", "utf8");
const request = (body: unknown, method = "POST") =>
  new NextRequest("http://test/api", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const get = (allocation: string, extra = "") =>
  new NextRequest(`http://test/api?allocation_id=${allocation}&date=2026-10-20${extra}`);
let dir: string;
let started = false;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "transfer-pg-"));
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "transfer_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`, "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "transfer_test", database: "postgres" });
  await db.query(`
    create type student_attendance_status as enum ('present','absent','leave');
    create table teachers (id uuid primary key, name text, deleted_at timestamptz);
    create table courses (id uuid primary key, title text);
    create table classes (id uuid primary key, class_name text, session text);
    create table semesters (id uuid primary key, class_id uuid, semester_number int, status text);
    create table semester_courses (semester_id uuid, course_id uuid, syllabus_completed_at timestamptz);
    create table allocations (id uuid primary key default gen_random_uuid(), course_id uuid, teacher_id uuid,
      allocation_type text default 'workload', rate numeric default 0, is_combined boolean default false,
      status text default 'active', started_at date, end_date date, transfer_group_id uuid,
      lecture_seq_offset int default 0, updated_at timestamptz default now());
    create table allocation_semesters (id uuid primary key default gen_random_uuid(), allocation_id uuid,
      semester_id uuid, course_id uuid);
    create table timetables (id uuid primary key, semester_id uuid, class_id uuid, updated_at timestamptz default now());
    create table timetable_days (id uuid primary key, day_name text);
    create table timetable_periods (id uuid primary key, start_time time, end_time time);
    create table timetable_cells (id uuid primary key, timetable_id uuid, day_id uuid, period_id uuid,
      allocation_id uuid, updated_at timestamptz default now());
    create table attendance_records (id uuid primary key default gen_random_uuid(), allocation_id uuid,
      attendance_date date, lecture_count numeric, bill_item_id uuid);
    create table dit_mock_results (allocation_id uuid, submitted_by uuid, updated_at timestamptz);
    create table notifications (recipient_type text, recipient_id uuid, title text, message text);
    create table students (id uuid primary key, class_id uuid, name text, father_name text, roll_no text,
      contact text, status text, deleted_at timestamptz);
    create table student_leaves (student_id uuid, revoked_at timestamptz, leave_type text,
      leave_start_date date, leave_end_date date);
    create table student_attendance_records (student_id uuid, attendance_date date, status text);
    create table student_course_attendance (allocation_id uuid, student_id uuid, attendance_date date,
      start_time time, end_time time, status student_attendance_status, reason text, call_remarks text,
      marked_by uuid, updated_at timestamptz default now());
    create unique index course_att_slot on student_course_attendance
      (allocation_id,student_id,attendance_date,start_time,end_time) where start_time is not null;
  `);
});
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await db.query(`truncate teachers,courses,classes,semesters,semester_courses,allocations,allocation_semesters,
    timetables,timetable_days,timetable_periods,timetable_cells,attendance_records,dit_mock_results,notifications,
    students,student_leaves,student_attendance_records,student_course_attendance;
    insert into teachers (id,name) values ('${id(1)}','Previous'),('${id(2)}','Asif'),('${id(3)}','Intermediate');
    insert into courses values ('${id(4)}','Cyber Security');
    insert into classes values ('${id(5)}','BS IT (BZU)','2022-26'),('${id(6)}','Combined class','2022-26');
    insert into semesters values ('${id(7)}','${id(5)}',8,'active'),('${id(8)}','${id(6)}',8,'active'),
      ('${id(9)}','${id(5)}',7,'closed');
    insert into semester_courses values ('${id(7)}','${id(4)}',null),('${id(8)}','${id(4)}',null);
    insert into allocations (id,course_id,teacher_id,status,transfer_group_id) values
      ('${id(10)}','${id(4)}','${id(1)}','transferred','${id(40)}'),
      ('${id(11)}','${id(4)}','${id(3)}','active','${id(40)}');
    insert into allocation_semesters (allocation_id,semester_id,course_id) values
      ('${id(10)}','${id(7)}','${id(4)}'),('${id(11)}','${id(7)}','${id(4)}');
    insert into timetables (id,semester_id,class_id) values ('${id(12)}','${id(7)}','${id(5)}'),('${id(13)}','${id(9)}','${id(5)}');
    insert into timetable_days values ('${id(14)}','Tuesday');
    insert into timetable_periods values ('${id(15)}','09:00','10:00');
    insert into timetable_cells (id,timetable_id,day_id,period_id,allocation_id) values
      ('${id(16)}','${id(12)}','${id(14)}','${id(15)}','${id(10)}'),
      ('${id(17)}','${id(13)}','${id(14)}','${id(15)}','${id(10)}');
    insert into students (id,class_id,name,status) values ('${id(20)}','${id(5)}','Student A','active'),
      ('${id(21)}','${id(6)}','Student B','active');
    insert into attendance_records (allocation_id,attendance_date,lecture_count,bill_item_id)
      values ('${id(10)}','2026-10-06',1,'${id(50)}');
    insert into student_course_attendance (allocation_id,student_id,attendance_date,start_time,end_time,status,marked_by)
      values ('${id(10)}','${id(20)}','2026-10-06','09:00','10:00','present','${id(1)}');
  `);
});

const doTransfer = () => transfer(request({ new_teacher_id: id(2), transfer_date: "2026-10-19" }),
  { params: Promise.resolve({ id: id(11) }) });
const cellAllocation = async (cell = id(16)) =>
  (await db.query("select allocation_id from timetable_cells where id=$1", [cell])).rows[0].allocation_id;
const assertHistory = async () => {
  expect(await cellAllocation(id(17))).toBe(id(10));
  expect((await db.query("select allocation_id,bill_item_id from attendance_records")).rows)
    .toEqual([{ allocation_id: id(10), bill_item_id: id(50) }]);
  expect((await db.query("select allocation_id,marked_by from student_course_attendance where attendance_date='2026-10-06'")).rows)
    .toEqual([{ allocation_id: id(10), marked_by: id(1) }]);
};
const assertRoster = async (allocation: string, expected: number) => {
  const slotResponse = await slots(get(allocation));
  expect(slotResponse.status).toBe(200);
  expect((await slotResponse.json()).slots).toEqual([{ start_time: "09:00:00", end_time: "10:00:00" }]);
  const response = await roster(get(allocation, "&start_time=09:00&end_time=10:00"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.rows).toHaveLength(expected);
  const saved = await saveRoster(request({ allocation_id: allocation, attendance_date: "2026-10-20",
    start_time: "09:00", end_time: "10:00",
    rows: data.rows.map((row: { student_id: string }) => ({ student_id: row.student_id, status: "present" })),
  }));
  expect(saved.status).toBe(200);
  expect((await db.query("select count(*)::int as n from student_course_attendance where allocation_id=$1", [allocation])).rows[0].n)
    .toBe(expected);
};

describe("transferred allocation timetable and attendance", () => {
  it("repairs legacy schedule links, loads and saves the new teacher's roster, preserving history", async () => {
    await db.query(`update allocations set teacher_id='${id(2)}' where id='${id(11)}'`);
    expect((await slots(get(id(11))).then((r) => r.json())).slots).toEqual([]);
    await db.query(migration);
    expect(await cellAllocation()).toBe(id(11));
    await assertRoster(id(11), 1);
    await assertHistory();
    await db.query(migration); // idempotent
    expect(await cellAllocation()).toBe(id(11));
  });

  it("carries ancestor cells through repeated transfers, with combined rosters and unchanged history", async () => {
    await db.query(`update allocations set is_combined=true where id in ('${id(10)}','${id(11)}');
      insert into allocation_semesters (allocation_id,semester_id,course_id) values ('${id(11)}','${id(8)}','${id(4)}');`);
    const response = await doTransfer();
    expect(response.status).toBe(200);
    const { new_allocation_id: allocation } = await response.json();
    expect(await cellAllocation()).toBe(allocation);
    await assertRoster(allocation, 2);
    await assertHistory();
    expect((await roster(get(id(11), "&start_time=09:00&end_time=10:00"))).status).toBe(403);
  });

  it("rejects a stale timetable save that selects a transferred allocation", async () => {
    await db.query(migration);
    const response = await place(request({ allocation_id: id(10) }, "PATCH"),
      { params: Promise.resolve({ id: id(12), cellId: id(16) }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("transferred");
    expect(await cellAllocation()).toBe(id(11));
  });

  it("still permits scheduling the current active allocation", async () => {
    const response = await place(request({ allocation_id: id(11) }, "PATCH"),
      { params: Promise.resolve({ id: id(12), cellId: id(16) }) });
    expect(response.status).toBe(200);
    expect(await cellAllocation()).toBe(id(11));
  });

  it("does not guess a successor outside the cell's semester or course", async () => {
    await db.query(`update allocation_semesters set semester_id='${id(8)}' where allocation_id='${id(11)}'`);
    await db.query(migration);
    expect(await cellAllocation()).toBe(id(10));
    await db.query(`update allocation_semesters set semester_id='${id(7)}' where allocation_id='${id(11)}';
      update allocations set course_id='${id(60)}' where id='${id(11)}'`);
    await db.query(migration);
    expect(await cellAllocation()).toBe(id(10));
  });

  it("does not repair ambiguous chains with multiple active successors", async () => {
    await db.query(`insert into allocations (id,course_id,teacher_id,transfer_group_id)
      values ('${id(30)}','${id(4)}','${id(2)}','${id(40)}');
      insert into allocation_semesters (allocation_id,semester_id,course_id)
      values ('${id(30)}','${id(7)}','${id(4)}');`);
    await db.query(migration);
    expect(await cellAllocation()).toBe(id(10));
  });
});
