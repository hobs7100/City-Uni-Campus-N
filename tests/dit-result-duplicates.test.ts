import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest } from "next/server";

// Exercise the actual routes and migrations, without using the campus database.
let db: Pool;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const teacher = id(1), allocation = id(2), semester = id(3), student = id(4), series = id(5);
vi.mock("@/lib/db", () => ({
  pool: { connect: () => db.connect() },
  query: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows,
  queryOne: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows[0] ?? null,
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => ({ session: { userId: teacher }, response: null }),
}));
import { GET, POST } from "../app/api/teacher/dit/results/route";
import { PATCH } from "../app/api/teacher/dit/all-results/route";

let dir: string;
let started = false;
let cleanupCounts: { active: number; archived: number; marks: number };
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
  dir = mkdtempSync(join(tmpdir(), "dit-duplicates-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "dit_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "dit_test", database: "postgres" });
  await db.query(`
    create table teachers(id uuid primary key);
    create table courses(id uuid primary key);
    create table classes(id uuid primary key, type text);
    create table semesters(id uuid primary key, class_id uuid, status text);
    create table allocations(id uuid primary key, teacher_id uuid, course_id uuid, status text);
    create table allocation_semesters(allocation_id uuid, semester_id uuid);
    create table students(id uuid primary key, class_id uuid, status text, deleted_at timestamptz,
      name text, father_name text, roll_no text);
    create table student_course_attendance(student_id uuid, allocation_id uuid, marked_by uuid, status text);
    insert into teachers values('${teacher}');
    insert into courses values('${id(6)}');
    insert into classes values('${id(7)}','DIT');
    insert into semesters values('${semester}','${id(7)}','active');
    insert into allocations values('${allocation}','${teacher}','${id(6)}','active');
    insert into allocation_semesters values('${allocation}','${semester}');
    insert into students values('${student}','${id(7)}','active',null,'Student',null,'1');
  `);
  await db.query(readFileSync("db/migrations/023_dit_mock_exam.sql", "utf8"));
  await db.query(`insert into dit_test_series(id,name,total_marks,passing_marks)
    values('${series}','Mock One',100,40),('${id(8)}','Mock Two',100,40);
    insert into dit_mock_results(test_series_id,allocation_id,semester_id,student_id,test_date,
      obtained_marks,submitted_by,updated_at) values
    ('${series}','${allocation}','${semester}','${student}','2026-10-01',20,'${teacher}','2026-10-03'),
    ('${series}','${allocation}','${semester}','${student}','2026-10-02',85,'${teacher}','2026-10-04');`);
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(readFileSync("db/migrations/068_dit_result_no_duplicates.sql", "utf8"));
    await client.query("commit");
  } finally { client.release(); }
  cleanupCounts = (await db.query(`select
    (select count(*)::int from dit_mock_results) active,
    (select count(*)::int from dit_mock_result_duplicates_archive) archived,
    (select obtained_marks from dit_mock_results limit 1) marks`)).rows[0];
}, 30000);
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const request = (marks = 65, date = "2026-10-10", extra = {}) => new NextRequest("http://localhost/api/teacher/dit/results", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({
    allocation_id: allocation, semester_id: semester, test_series_id: series, test_date: date,
    rows: [{ student_id: student, obtained_marks: marks, is_absent: false }], ...extra,
  }),
});
const saved = async () => (await db.query("select * from dit_mock_results")).rows;

describe("DIT result identity and duplicate cleanup", () => {
  beforeEach(async () => { await db.query("truncate dit_mock_results"); });

  it("archives the older duplicate and keeps the most recently updated marks", async () => {
    expect(cleanupCounts).toEqual({ active: 1, archived: 1, marks: 85 });
    expect((await db.query("select obtained_marks from dit_mock_result_duplicates_archive")).rows[0].obtained_marks).toBe(20);
  });

  it("repeated saves and a changed exam date update the same row", async () => {
    expect((await POST(request())).status).toBe(200);
    const original = (await saved())[0];
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request(92, "2026-10-11"))).status).toBe(200);
    const rows = await saved();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(original.id);
    expect(rows[0].obtained_marks).toBe(92);
    expect(rows[0].test_date.toISOString().slice(0, 10)).toBe("2026-10-11");
  });

  it("loads existing marks even when another date is selected", async () => {
    await POST(request(78));
    const params = new URLSearchParams({ allocation_id: allocation, semester_id: semester,
      test_series_id: series, test_date: "2026-10-25" });
    const response = await GET(new NextRequest(`http://localhost/api/teacher/dit/results?${params}`));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.students).toHaveLength(1);
    expect(data.students[0].obtained_marks).toBe(78);
    expect(data.students[0].result_id).toBeTruthy();
  });

  it("serializes simultaneous submissions without duplicating the assessment", async () => {
    const responses = await Promise.all([POST(request(35)), POST(request(60, "2026-10-12")), POST(request(70))]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await saved()).toHaveLength(1);
  });

  it("enforces uniqueness in PostgreSQL even if a writer bypasses the API", async () => {
    await POST(request());
    await expect(db.query(`insert into dit_mock_results
      (test_series_id,allocation_id,semester_id,student_id,test_date,obtained_marks,submitted_by)
      values($1,$2,$3,$4,'2026-10-30',90,$5)`, [series, allocation, semester, student, teacher]))
      .rejects.toMatchObject({ code: "23505" });
  });

  it("keeps distinct test series separate", async () => {
    await POST(request());
    expect((await POST(request(80, "2026-10-10", { test_series_id: id(8) }))).status).toBe(200);
    expect(await saved()).toHaveLength(2);
  });

  it("edits an existing result by ID without inserting another row", async () => {
    await POST(request());
    const original = (await saved())[0];
    const response = await PATCH(new NextRequest("http://localhost/api/teacher/dit/all-results", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: original.id, obtained_marks: 95 }),
    }));
    expect(response.status).toBe(200);
    expect(await saved()).toHaveLength(1);
    expect((await saved())[0]).toMatchObject({ id: original.id, obtained_marks: 95 });
  });

  it("preserves absence and rejects duplicate students or invalid marks atomically", async () => {
    const rows = [{ student_id: student, obtained_marks: 0, is_absent: true }];
    expect((await POST(request(0, "2026-10-10", { rows }))).status).toBe(200);
    expect((await saved())[0]).toMatchObject({ is_absent: true, obtained_marks: 0 });
    expect((await POST(request(101))).status).toBe(400);
    expect((await POST(request(0, "2026-10-10", { rows: [...rows, ...rows] }))).status).toBe(400);
    expect(await saved()).toHaveLength(1);
    expect((await saved())[0].is_absent).toBe(true);
  });
});
