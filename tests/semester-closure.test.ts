import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest } from "next/server";

// All route SQL and migrations run against isolated PostgreSQL, never Supabase.
let db: Pool;
vi.mock("@/lib/db", () => ({
  pool: { connect: () => db.connect() },
  query: async (sql: string, values?: unknown[]) => (await db.query(sql, values)).rows,
  queryOne: async (sql: string, values?: unknown[]) => (await db.query(sql, values)).rows[0] ?? null,
}));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => ({ session: { userId: "00000000-0000-4000-8000-000000000099" }, response: null }),
}));
vi.mock("@/lib/portalPermissions", () => ({
  requirePortalPermission: async () => ({ session: { userId: "00000000-0000-4000-8000-000000000099" }, response: null }),
}));
import { GET as lecturesGET } from "../app/api/admin/attendance/lectures/route";
import { POST as attendancePOST } from "../app/api/admin/attendance/route";
import { PATCH as cellPATCH } from "../app/api/admin/timetables/[id]/cells/[cellId]/route";
import { POST as classPOST } from "../app/api/admin/classes/route";
import { PATCH as classPATCH } from "../app/api/admin/classes/[id]/route";
import { POST as semesterPOST } from "../app/api/admin/semesters/route";

let dir: string;
let started = false;
const migration = readFileSync(join(process.cwd(), "db/migrations/066_semester_closure_and_class_start.sql"), "utf8");
const request = (url: string, body: unknown, method = "POST") =>
  new NextRequest(`http://test${url}`, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "semester-pg-"));
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "semester_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`, "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "semester_test", database: "postgres" });
  await db.query(`
    create table departments (id uuid primary key, name text);
    create table classes (id uuid primary key default gen_random_uuid(), department_id uuid, class_name text, session text,
      affiliation_id uuid, type text, total_semesters int, status text default 'active', scheme_of_studies_url text, updated_at timestamptz default now());
    create table semesters (id uuid primary key default gen_random_uuid(), department_id uuid, class_id uuid, semester_number int,
      term_type text, start_date date, status text, close_date date, updated_at timestamptz default now());
    create table semester_courses (semester_id uuid, course_id uuid, syllabus_completed_at timestamptz, syllabus_completed_by uuid,
      primary key(semester_id,course_id));
    create table teachers (id uuid primary key, name text, type text, department_id uuid);
    create table courses (id uuid primary key, code text, title text);
    create table allocations (id uuid primary key, teacher_id uuid, course_id uuid, is_combined boolean, status text default 'active');
    create table allocation_semesters (allocation_id uuid, semester_id uuid, course_id uuid);
    create table timetables (id uuid primary key, semester_id uuid, class_id uuid, department_id uuid, updated_at timestamptz default now());
    create table timetable_days (id uuid primary key, day_name text);
    create table timetable_periods (id uuid primary key, start_time time, end_time time);
    create table timetable_cells (id uuid primary key, timetable_id uuid, day_id uuid, period_id uuid, allocation_id uuid, updated_at timestamptz default now());
    create table attendance_records (id uuid primary key default gen_random_uuid(), allocation_id uuid, attendance_date date,
      start_time time, end_time time, lecture_count numeric, late_minutes int, status text, remarks text, marked_by uuid,
      bill_item_id uuid, updated_at timestamptz default now(), unique(allocation_id,attendance_date,start_time,end_time));
    insert into classes (id,class_name,session,type,total_semesters) values
      ('${id(90)}','BS Accounting  & Finance (BZU)','2022-26','BS',8),
      ('${id(91)}','Other BS','2022-26','BS',8),
      ('${id(92)}','English Bridging','2024-26','BS-Bridging',4);
    insert into semesters (id,class_id,status) values ('${id(93)}','${id(92)}','closed');
    insert into semester_courses values ('${id(93)}','${id(94)}',null,null),
      ('${id(93)}','${id(95)}','2026-01-01','${id(99)}');
  `);
  await db.query(migration);
});
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("migration repair", () => {
  it("repairs closed courses, preserves manual completion and corrects only the identified late-entry class", async () => {
    const rows = (await db.query(`select * from semester_courses where semester_id='${id(93)}' order by course_id`)).rows;
    expect(rows[0].syllabus_completed_at).not.toBeNull();
    expect(rows[1].syllabus_completed_at.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(rows[1].syllabus_completed_by).toBe(id(99));
    const classes = (await db.query(`select starting_semester from classes order by id`)).rows;
    expect(classes.map((c) => c.starting_semester)).toEqual([8, 1, 5]);
  });
});

describe("closed semester routes and progression", () => {
  beforeEach(async () => {
    await db.query(`truncate attendance_records,timetable_cells,timetable_days,timetable_periods,timetables,
      allocation_semesters,allocations,semester_courses,semesters,classes,courses,teachers,departments;
      insert into departments values ('${id(1)}','English');
      insert into teachers values ('${id(2)}','Teacher','visiting','${id(1)}');
      insert into courses values ('${id(3)}','OLD','Old course'),('${id(4)}','NEW','New course');
      insert into classes (id,department_id,class_name,session,type,total_semesters,starting_semester) values
        ('${id(5)}','${id(1)}','Bridging','2024-26','BS-Bridging',4,5),
        ('${id(6)}','${id(1)}','BS Class','2022-26','BS',8,8);
      insert into semesters (id,department_id,class_id,semester_number,status) values
        ('${id(7)}','${id(1)}','${id(5)}',7,'active'),('${id(8)}','${id(1)}','${id(6)}',8,'active');
      insert into semester_courses values ('${id(7)}','${id(3)}',null,null),('${id(8)}','${id(4)}',null,null);
      insert into allocations (id,teacher_id,course_id,is_combined) values
        ('${id(9)}','${id(2)}','${id(3)}',false),('${id(10)}','${id(2)}','${id(4)}',false);
      insert into allocation_semesters values ('${id(9)}','${id(7)}','${id(3)}'),('${id(10)}','${id(8)}','${id(4)}');
      insert into timetables (id,semester_id,class_id,department_id) values
        ('${id(11)}','${id(7)}','${id(5)}','${id(1)}'),('${id(12)}','${id(8)}','${id(6)}','${id(1)}');
      insert into timetable_days values ('${id(13)}','Monday');
      insert into timetable_periods values ('${id(14)}','09:00','10:00'),('${id(17)}','09:30','10:30');
      insert into timetable_cells (id,timetable_id,day_id,period_id,allocation_id) values
        ('${id(15)}','${id(11)}','${id(13)}','${id(14)}','${id(9)}'),
        ('${id(16)}','${id(12)}','${id(13)}','${id(14)}',null);
    `);
  });

  const close = () => db.query(`update semesters set status='closed', close_date='2026-10-01' where id='${id(7)}'`);
  const place = (allocation = id(10), timetable = id(12), cell = id(16)) =>
    cellPATCH(request("/cell", { allocation_id: allocation }, "PATCH"), { params: Promise.resolve({ id: timetable, cellId: cell }) });
  const attendance = (allocation = id(9)) => attendancePOST(request("/attendance", {
    allocation_id: allocation, attendance_date: "2026-09-28", start_time: "09:00", end_time: "10:00", lecture_count: 1,
  }));

  it("closing automatically completes courses without deleting timetable or attendance history", async () => {
    expect((await attendance()).status).toBe(201);
    await close();
    expect((await db.query(`select syllabus_completed_at from semester_courses where semester_id='${id(7)}'`)).rows[0].syllabus_completed_at).not.toBeNull();
    expect((await db.query("select count(*)::int as n from attendance_records")).rows[0].n).toBe(1);
    expect((await db.query("select count(*)::int as n from timetable_cells")).rows[0].n).toBe(2);
    expect((await attendance()).status).toBe(409);
  });

  it("closed-semester status alone excludes attendance and clashes even with a stale incomplete course flag", async () => {
    expect((await place()).status).toBe(409);
    await close();
    await db.query(`update semester_courses set syllabus_completed_at=null where semester_id='${id(7)}'`);
    const lectures = await lecturesGET(new NextRequest("http://test/lectures?date=2026-09-28"));
    expect((await lectures.json()).lectures).toEqual([]);
    expect((await attendance()).status).toBe(409);
    expect((await place()).status).toBe(200);
    expect((await place(id(9), id(11), id(15))).status).toBe(409);
  });

  it("keeps a combined allocation's other active leg usable and ignores its closed overlapping slot", async () => {
    await db.query(`update allocations set is_combined=true where id='${id(9)}';
      insert into allocation_semesters values ('${id(9)}','${id(8)}','${id(3)}');
      insert into semester_courses values ('${id(8)}','${id(3)}',null,null);
      update timetable_cells set period_id='${id(17)}' where id='${id(15)}'`);
    await close();
    expect((await place(id(9))).status).toBe(200);
    expect((await attendance()).status).toBe(201);
    const lectures = await lecturesGET(new NextRequest("http://test/lectures?date=2026-09-28"));
    const rows = (await lectures.json()).lectures;
    expect(rows).toHaveLength(1);
    expect(rows[0].classes).toEqual([{ class_name: "BS Class", session: "2022-26" }]);
    expect((await db.query(`select syllabus_completed_at from semester_courses where semester_id='${id(8)}' and course_id='${id(3)}'`)).rows[0].syllabus_completed_at).toBeNull();
  });

  it("rejects closed-only allocation attendance even when its timetable slot was removed", async () => {
    await close();
    await db.query(`delete from timetable_cells where allocation_id='${id(9)}'`);
    expect((await attendance()).status).toBe(409);
  });

  it("requires a valid class starting semester and persists it on create and edit", async () => {
    const body = { department_id: id(1), class_name: "New BS", session: "2026-30", type: "BS", starting_semester: 8 };
    expect((await classPOST(request("/classes", { ...body, starting_semester: undefined }))).status).toBe(400);
    expect((await classPOST(request("/classes", { ...body, starting_semester: 9 }))).status).toBe(400);
    const result = await classPOST(request("/classes", body));
    expect(result.status).toBe(201);
    const created = (await result.json()).class;
    expect(created.starting_semester).toBe(8);
    const edited = await classPATCH(request("/classes", { starting_semester: 7 }, "PATCH"), { params: Promise.resolve({ id: created.id }) });
    expect((await edited.json()).class.starting_semester).toBe(7);
    const invalid = await classPATCH(request("/classes", { starting_semester: 8 }, "PATCH"), { params: Promise.resolve({ id: id(5) }) });
    expect(invalid.status).toBe(409);
    expect((await classPOST(request("/classes", { ...body, class_name: "English Bridging", starting_semester: 1 }))).status).toBe(400);
  });

  it("starts an empty late-entry cohort at 8, not 1, and preserves progression after 7", async () => {
    await db.query(`delete from semesters where id='${id(8)}'`);
    const body = { department_id: id(1), class_id: id(6), semester_number: 1, term_type: "Fall", start_date: "2026-10-01", course_ids: [id(4)] };
    expect((await semesterPOST(request("/semesters", body))).status).toBe(400);
    const response = await semesterPOST(request("/semesters", { ...body, semester_number: 8 }));
    expect(response.status).toBe(201);
    expect((await response.json()).semester.semester_number).toBe(8);
    expect((await db.query(`select semester_number from semesters where class_id='${id(6)}'`)).rows).toEqual([{ semester_number: 8 }]);
    await close();
    expect((await semesterPOST(request("/semesters", { ...body, class_id: id(5), semester_number: 8 }))).status).toBe(201);
  });
});
