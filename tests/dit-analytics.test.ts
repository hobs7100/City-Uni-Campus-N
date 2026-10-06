import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";

// Actual SQL runs only in this isolated PostgreSQL database, never campus data.
let db: Pool;
let deny = false;
vi.mock("@/lib/db", () => ({
  query: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows,
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => ({ response: deny ? NextResponse.json({ error: "Forbidden" }, { status: 403 }) : null }),
}));
import { GET as subjects } from "../app/api/admin/dit/analytics/route";
import { GET as zones } from "../app/api/admin/dit/analytics/zones/route";
import { GET as range } from "../app/api/admin/dit/analytics/percentage-range/route";
import { changeAnalyticsFilter, filterChoices, type AnalyticsOptions } from "../app/dashboard/admin/dit-mock/analyticsFilters";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1), B = id(2), BS = id(3), S1 = id(4), S2 = id(5), SB = id(6), SBS = id(7);
const C1 = id(20), C2 = id(21), T1 = id(30), T2 = id(31);
let dir: string;
let started = false;
let optionData: AnalyticsOptions;

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
  dir = mkdtempSync(join(tmpdir(), "dit-analytics-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "dit_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "dit_test", database: "postgres" });
  await db.query(`
    create table classes(id uuid primary key, class_name text, session text, type text);
    create table semesters(id uuid primary key, class_id uuid, semester_number int, term_type text);
    create table students(id uuid primary key, name text, father_name text, roll_no text, deleted_at timestamptz);
    create table courses(id uuid primary key, code text, title text);
    create table allocations(id uuid primary key, course_id uuid);
    create table allocation_semesters(allocation_id uuid, semester_id uuid);
    create table dit_test_series(id uuid primary key, name text, total_marks int, passing_marks int, created_at timestamptz default now());
    create table dit_mock_results(id uuid default gen_random_uuid(), student_id uuid, semester_id uuid,
      allocation_id uuid, test_series_id uuid, test_date date, obtained_marks int, is_absent boolean default false);
    insert into classes values('${A}','Digital Leaders','2026','DIT'),('${B}','Digital Innovators','2025','DIT'),('${BS}','BS Class','2026','BS');
    insert into semesters values('${S1}','${A}',1,'Regular'),('${S2}','${A}',2,'Regular'),('${SB}','${B}',1,'Regular'),('${SBS}','${BS}',1,'Regular');
    insert into students(id,name,roll_no) values
      ('${id(10)}','Student One','1'),('${id(11)}','Student Two','2'),('${id(12)}','Student Three','3'),
      ('${id(13)}','Other Class','4'),('${id(14)}','Old Semester','5'),('${id(15)}','BS Student','6');
    insert into courses values('${C1}','C1','Computing'),('${C2}','C2','Networking');
    insert into allocations values('${id(40)}','${C1}'),('${id(41)}','${C2}');
    insert into allocation_semesters values('${id(40)}','${S1}'),('${id(40)}','${S2}'),('${id(40)}','${SB}'),('${id(41)}','${S1}');
    insert into dit_test_series(id,name,total_marks,passing_marks) values('${T1}','Test One',100,40),('${T2}','Test Two',200,80);
    insert into dit_mock_results(student_id,semester_id,allocation_id,test_series_id,test_date,obtained_marks,is_absent) values
      ('${id(10)}','${S1}','${id(40)}','${T1}','2026-09-01',60,false),
      ('${id(11)}','${S1}','${id(40)}','${T1}','2026-09-01',90,false),
      ('${id(12)}','${S1}','${id(40)}','${T1}','2026-09-01',100,false),
      ('${id(10)}','${S1}','${id(41)}','${T2}','2026-09-02',100,false),
      ('${id(11)}','${S1}','${id(41)}','${T2}','2026-09-02',200,true),
      ('${id(12)}','${S1}','${id(41)}','${T2}','2026-09-02',100,false),
      ('${id(13)}','${SB}','${id(40)}','${T1}','2026-09-01',60,false),
      ('${id(14)}','${S2}','${id(40)}','${T1}','2026-08-01',95,false),
      ('${id(15)}','${SBS}','${id(40)}','${T1}','2026-09-01',100,false);
  `);
  const response = await subjects(new NextRequest("http://localhost/api/admin/dit/analytics"));
  optionData = (await response.json()).filter_options;
}, 30000);

afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
const request = (params: Record<string, string> = {}) => new NextRequest(`http://localhost/api/admin/dit/analytics?${new URLSearchParams(params)}`);

describe("DIT analytics filters against PostgreSQL", () => {
  const cases = [
    [{}, 5],
    [{ class_id: A }, 4],
    [{ semester_id: S1 }, 3],
    [{ session: "2025" }, 1],
    [{ course_id: C2 }, 3],
    [{ test_series_id: T2 }, 3],
    [{ from_date: "2026-09-02", to_date: "2026-09-02" }, 3],
    [{ class_id: A, semester_id: S1, course_id: C1, test_series_id: T1, session: "2026", from_date: "2026-09-01", to_date: "2026-09-01" }, 3],
    [{ class_id: B, semester_id: S1 }, 0],
    [{ from_date: "2027-01-01" }, 0],
  ] as [Record<string, string>, number][];
  it.each(cases)("subject analytics applies %j (expected %i students)", async (filters, count) => {
    const response = await subjects(request(filters));
    expect(response.status).toBe(200);
    expect((await response.json()).summary.unique_student_count).toBe(count);
  });
  it.each(cases)("overall zones applies %j (expected %i students)", async (filters, count) => {
    const response = await zones(request({ ...filters, zone: "warning" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Object.values(data.zone_counts).reduce((sum: number, n) => sum + Number(n), 0)).toBe(count);
    expect(data.rows.every((row: { zone: string }) => row.zone === "warning")).toBe(true);
  });
  it.each(cases)("percentage report applies %j (expected %i students)", async (filters, count) => {
    const response = await range(request(filters));
    expect(response.status).toBe(200);
    expect((await response.json()).students).toHaveLength(count);
  });
  it("includes both endpoints of the selected percentage range", async () => {
    const response = await range(request({ class_id: A, semester_id: S1, course_id: C1, min_percentage: "60", max_percentage: "90" }));
    const data = await response.json();
    expect(data.students.map((row: { percentage: number }) => row.percentage)).toEqual([90, 60]);
  });
  it("supports equal endpoints and zero/100 percentages", async () => {
    const perfect = await range(request({ class_id: A, course_id: C1, min_percentage: "100", max_percentage: "100" }));
    expect((await perfect.json()).students.map((row: { percentage: number }) => row.percentage)).toEqual([100]);
    const absent = await range(request({ course_id: C2, min_percentage: "0", max_percentage: "0" }));
    expect((await absent.json()).students[0]).toMatchObject({ student_id: id(11), total_obtained: 0, percentage: 0 });
  });
  it("uses weighted totals rather than the average of test percentages", async () => {
    const response = await range(request({ semester_id: S1 }));
    const one = (await response.json()).students.find((row: { student_id: string }) => row.student_id === id(10));
    expect(one).toMatchObject({ total_obtained: 160, total_marks: 300, test_count: 2 });
    expect(one.percentage).toBeCloseTo(53.3333333);
  });
  it("applies the range before rounding and agrees with zone results", async () => {
    const filters = { semester_id: S1, min_percentage: "53.34", max_percentage: "59.99" };
    expect((await (await range(request(filters))).json()).students).toEqual([]);
    const warning = (await (await zones(request({ semester_id: S1, zone: "warning" }))).json()).rows[0];
    const matching = (await (await range(request({ semester_id: S1, min_percentage: "50", max_percentage: "59.99" }))).json()).students[0];
    expect(matching.percentage).toBe(warning.percentage);
    expect(matching.student_id).toBe(warning.student_id);
  });
  it.each([
    { min_percentage: "-1" }, { max_percentage: "101" }, { min_percentage: "abc" },
    { min_percentage: "" }, { min_percentage: "80", max_percentage: "60" },
    { from_date: "2026-10-01", to_date: "2026-09-01" }, { class_id: "invalid" },
  ] as Record<string, string>[])("rejects invalid range/date/identity inputs %j", async (filters) => {
    expect((await range(request(filters))).status).toBe(400);
  });
  it("rejects reversed dates on both existing reports", async () => {
    const filters = { from_date: "2026-10-01", to_date: "2026-09-01" };
    expect((await subjects(request(filters))).status).toBe(400);
    expect((await zones(request(filters))).status).toBe(400);
  });
  it("preserves access control on all three report APIs", async () => {
    deny = true;
    try {
      for (const handler of [subjects, zones, range]) expect((await handler(request())).status).toBe(403);
    } finally { deny = false; }
  });
});

describe("dependent report dropdowns", () => {
  it("labels semesters with class and session to avoid ambiguous identical numbers", () => {
    expect(filterChoices(optionData, "semester_id", {}).map((item) => item.label)).toContain("Digital Innovators · Semester 1 (2025 · Regular)");
  });
  it("restricts semester choices to the selected class", () => {
    expect(filterChoices(optionData, "semester_id", { class_id: B }).map((item) => item.value)).toEqual([SB]);
  });
  it("clears stale semester and course selections when switching class", () => {
    expect(changeAnalyticsFilter(optionData, { class_id: A, semester_id: S1, course_id: C2 }, "class_id", B))
      .toMatchObject({ class_id: B, semester_id: "", course_id: "" });
  });
  it("clears incompatible class/semester/course when session changes", () => {
    expect(changeAnalyticsFilter(optionData, { class_id: A, semester_id: S1, course_id: C2 }, "session", "2025"))
      .toMatchObject({ session: "2025", class_id: "", semester_id: "", course_id: "" });
  });
  it("clearing a class makes all semester choices available again", () => {
    expect(filterChoices(optionData, "semester_id", { class_id: "" })).toHaveLength(3);
  });
  it("restricts courses to the selected class and semester", () => {
    expect(filterChoices(optionData, "course_id", { class_id: B, semester_id: SB }).map((item) => item.value)).toEqual([C1]);
  });
});
