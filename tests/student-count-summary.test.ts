import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextResponse } from "next/server";
import { buildStudentCountSummary, type StudentCountRow } from "../lib/student-count-summary";
import { createStudentCountSummaryPdf } from "../lib/student-count-summary-pdf";

let db: Pool;
let role = "admin";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
vi.mock("@/lib/db", () => ({
  query: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows,
}));
vi.mock("@/lib/requireRole", () => ({
  requireExactRole: async (...roles: string[]) => roles.includes(role)
    ? { session: { role }, response: null }
    : { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) },
}));
import { GET } from "../app/api/admin/students/count-summary/route";

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
  dir = mkdtempSync(join(tmpdir(), "student-count-summary-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "summary_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "summary_test", database: "postgres", max: 1 });
  await db.query(`
    create table departments(id uuid primary key,name text);
    create table classes(id uuid primary key,department_id uuid,class_name text,session text,status text);
    create table semesters(id uuid primary key,class_id uuid,semester_number int,status text,created_at timestamptz default now());
    create table students(id uuid primary key,class_id uuid,status text,deleted_at timestamptz);
    insert into departments values('${id(1)}','Computing'),('${id(2)}','English');
    insert into classes values
      ('${id(10)}','${id(1)}','CS2025','2025-2029','active'),
      ('${id(11)}','${id(1)}','CS2026','2026-2030','active'),
      ('${id(12)}','${id(2)}','English2025','2025-2029','active'),
      ('${id(13)}','${id(2)}','BlockedClass','2020-2024','blocked');
    insert into semesters(id,class_id,semester_number,status) values
      ('${id(20)}','${id(10)}',1,'closed'),
      ('${id(21)}','${id(10)}',2,'closed'),
      ('${id(22)}','${id(10)}',3,'active'),
      ('${id(23)}','${id(11)}',1,'closed');
    insert into students values
      ('${id(30)}','${id(10)}','active',null),
      ('${id(31)}','${id(10)}','active',null),
      ('${id(32)}','${id(10)}','struck_off',null),
      ('${id(33)}','${id(10)}','active',now()),
      ('${id(34)}','${id(10)}','struck_off',now()),
      ('${id(35)}','${id(10)}','left',null),
      ('${id(36)}','${id(10)}','dropped',null),
      ('${id(37)}','${id(10)}','freezed',null),
      ('${id(38)}','${id(10)}','permanent_leave',null),
      ('${id(39)}','${id(10)}','alumni',null),
      ('${id(40)}','${id(11)}','active',null),
      ('${id(41)}','${id(11)}','struck_off',null),
      ('${id(42)}','${id(13)}','active',null),
      ('${id(43)}','${id(13)}','struck_off',null);
  `);
}, 30000);
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => { role = "admin"; });

describe("student count summary", () => {
  it("counts active and struck-off students once, excluding blocked classes and deleted/other-status students", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const summary = await response.json();
    expect(summary).toMatchObject({
      total_sessions: 2, sessions: ["2025-2029", "2026-2030"], total_classes: 3, total_students: 5,
    });
    expect(summary.departments.map((d: { department_name: string; total_students: number }) =>
      [d.department_name, d.total_students])).toEqual([["Computing", 5], ["English", 0]]);
    expect(summary.departments[0].classes).toMatchObject([
      { class_name: "CS2025", active_semester_number: 3, total_students: 3 },
      { class_name: "CS2026", active_semester_number: null, total_students: 2 },
    ]);
    expect(summary.departments[1].classes[0]).toMatchObject({
      class_name: "English2025", total_students: 0, active_semester_number: null,
    });
  });

  it.each(["assistant", "coordinator", "hod", "teacher", "student", "anonymous"])("denies %s access", async deniedRole => {
    role = deniedRole;
    expect((await GET()).status).toBe(403);
  });

  it("shows zero totals when there are no active classes", async () => {
    await db.query("begin");
    // This isolated test pool has one connection, so GET uses the same transaction.
    await db.query("update classes set status='blocked'");
    try {
      expect(await (await GET()).json()).toEqual({
        total_sessions: 0, sessions: [], total_classes: 0, total_students: 0, departments: [],
      });
    } finally {
      await db.query("rollback");
    }
  });

  it("exports overall statistics and session names on page one, then department details", async () => {
    const summary = await (await GET()).json();
    const doc = await createStudentCountSummaryPdf(summary);
    expect(doc.getNumberOfPages()).toBe(2);
    const pages = (doc.internal as unknown as { pages: string[][] }).pages;
    const cover = pages[1].join("\n"), detail = pages[2].join("\n");
    for (const text of ["Total Sessions: 2", "2025-2029, 2026-2030", "Total Classes: 3", "Total Students: 5"]) {
      expect(cover).toContain(text);
    }
    expect(cover).not.toContain("CS2025");
    for (const text of ["Computing", "English", "CS2025", "CS2026", "English2025", "Semester 3", "No active semester"]) {
      expect(detail).toContain(text);
    }
    expect(doc.output()).toContain("Page 2 of 2");
  });

  it("paginates large departments and wraps long class/session names without losing rows", async () => {
    const rows: StudentCountRow[] = Array.from({ length: 90 }, (_, index) => ({
      department_id: id(1), department_name: "Computing",
      class_id: id(100 + index), class_name: `UniqueClass${index} A long class name that wraps onto multiple lines`,
      session: "2025-2029 extended academic session label", active_semester_number: 5, total_students: index,
    }));
    const doc = await createStudentCountSummaryPdf(buildStudentCountSummary(rows));
    expect(doc.getNumberOfPages()).toBeGreaterThan(4);
    const text = doc.output();
    rows.forEach(row => expect(text).toContain(row.class_name.split(" ")[0]));
    expect(text).toContain("Department Total Students: 4005");
  });

  it("exports a valid zero-total report too", async () => {
    const doc = await createStudentCountSummaryPdf(buildStudentCountSummary([]));
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output()).toContain("Total Students: 0");
    expect(doc.output()).toContain("Sessions: None");
  });
});
