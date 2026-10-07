import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextResponse } from "next/server";

let db: Pool;
let signedIn = true;
let fine: { semester_id: string; paid_amount: number; net_amount: number } | null = null;
const sqlCalls: string[] = [];
vi.mock("@/lib/db", () => ({
  pool: { query: (sql: string, args?: unknown[]) => db.query(sql, args) },
  query: async (sql: string, args?: unknown[]) => { sqlCalls.push(sql); return (await db.query(sql, args)).rows; },
  queryOne: async (sql: string, args?: unknown[]) => { sqlCalls.push(sql); return (await db.query(sql, args)).rows[0] ?? null; },
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: async () => signedIn ? { session: { userId: id(1), role: "student" }, response: null }
    : { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) },
}));
vi.mock("@/lib/attendance-fines", () => ({ getCurrentAttendanceFine: async () => fine }));
import { GET as rollno } from "../app/api/student/rollno-slip/route";
import { GET as clearance } from "../app/api/student/clearance-slip/route";
import { buildExamSlipDocument } from "../components/studentDashboard/examSlipDocument";
import type { SlipData } from "../lib/exam-slip-types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STUDENT = id(1), CLASS = id(2), SEMESTER = id(3), DEPARTMENT = id(4), COURSE = id(5), COURSE2 = id(6);
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
  dir = mkdtempSync(join(tmpdir(), "slips-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "slip_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "slip_test", database: "postgres" });
  await db.query(`
    create table departments(id uuid primary key,name text);
    create table classes(id uuid primary key,class_name text);
    create table students(id uuid primary key,name text,father_name text,class_id uuid,
      session text,status text,department_id uuid,profile_image_url text,deleted_at timestamptz,reactivated_at timestamptz);
    create table student_leaves(student_id uuid,leave_type text,revoked_at timestamptz,created_at timestamptz default now());
    create table semesters(id uuid primary key,class_id uuid,status text,semester_number int,term_type text);
    create table courses(id uuid primary key,title text,code text,credit_hours int);
    create table semester_courses(semester_id uuid,course_id uuid);
    create table mid_exam_datesheets(semester_id uuid,course_id uuid,paper_date date,paper_time time);
    create table student_attendance_records(student_id uuid,semester_id uuid,status text,attendance_date date default current_date);
    create table rollno_slip_overrides(id uuid default gen_random_uuid(),student_id uuid);
    create table allocations(id uuid primary key,course_id uuid);
    create table allocation_semesters(allocation_id uuid,semester_id uuid);
    create table student_course_attendance(student_id uuid,allocation_id uuid,status text);
  `);
});
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  signedIn = true;
  fine = null;
  sqlCalls.length = 0;
  await db.query(`
    truncate departments,classes,students,student_leaves,semesters,courses,semester_courses,
      mid_exam_datesheets,student_attendance_records,rollno_slip_overrides,
      allocations,allocation_semesters,student_course_attendance;
    insert into departments values('${DEPARTMENT}','Computing');
    insert into classes values('${CLASS}','Test Class');
    insert into students values('${STUDENT}','Test Student','Test Parent','${CLASS}',
      '2026','active','${DEPARTMENT}','https://example.com/photo.png',null);
    insert into semesters values('${SEMESTER}','${CLASS}','active',1,'Regular');
    insert into courses values('${COURSE}','Theory Course','CS101',3),('${COURSE2}','Practical Course','CS101P',1);
    insert into semester_courses values('${SEMESTER}','${COURSE}'),('${SEMESTER}','${COURSE2}'),('${SEMESTER}','${COURSE}');
    insert into mid_exam_datesheets values('${SEMESTER}','${COURSE}','2026-10-12','09:00');
    insert into student_attendance_records select '${STUDENT}','${SEMESTER}',
      case when n<=15 then 'present' else 'absent' end, date '2026-09-01'+n from generate_series(1,20)n;
    insert into allocations values('${id(7)}','${COURSE}');
    insert into allocation_semesters values('${id(7)}','${SEMESTER}');
    insert into student_course_attendance values('${STUDENT}','${id(7)}','absent');
  `);
});

describe.each([["roll number", rollno], ["clearance", clearance]] as const)("%s slip shared eligibility", (_, handler) => {
  it("requires authentication", async () => {
    signedIn = false;
    expect((await handler()).status).toBe(401);
  });
  it.each(["struck_off", "alumni"])("blocks %s students through the actual student gate", async (status) => {
    await db.query("update students set status=$1", [status]);
    expect((await handler()).status).toBe(403);
  });
  it("requires a photo even with an attendance override", async () => {
    await db.query(`update students set profile_image_url=null; insert into rollno_slip_overrides(student_id) values('${STUDENT}')`);
    expect(await (await handler()).json()).toMatchObject({ allowed: false, reason: "missing_profile_photo" });
  });
  it("requires a current semester in the student's current class", async () => {
    await db.query("update semesters set class_id=$1", [id(99)]);
    expect(await (await handler()).json()).toMatchObject({ allowed: false, reason: "no_active_semester" });
  });
  it("uses only daily coordinator/admin attendance for eligibility", async () => {
    expect(await (await handler()).json()).toMatchObject({ allowed: true, overall_attendance: 75, roll_number_slip_threshold: 75 });
    await db.query("update student_attendance_records set status='absent'");
    await db.query("update student_course_attendance set status='present'");
    expect(await (await handler()).json()).toMatchObject({ allowed: false, reason: "low_attendance" });
  });
  it("excludes leave marks from the attendance denominator", async () => {
    await db.query(`insert into student_attendance_records select '${STUDENT}','${SEMESTER}','leave' from generate_series(1,50)`);
    expect(await (await handler()).json()).toMatchObject({ allowed: true, overall_attendance: 75 });
  });
  it("respects the same admin override outside protection", async () => {
    await db.query(`update student_attendance_records set status='absent'; insert into rollno_slip_overrides(student_id) values('${STUDENT}')`);
    expect(await (await handler()).json()).toMatchObject({ allowed: true, overall_attendance: 0 });
  });
  it("uses the partial-leave 40% boundary without rounding before comparison", async () => {
    await db.query(`insert into student_leaves(student_id,leave_type) values('${STUDENT}','partial');
      delete from student_attendance_records;
      insert into student_attendance_records select '${STUDENT}','${SEMESTER}',
        case when n<=8 then 'present' else 'absent' end, date '2026-09-01'+n from generate_series(1,20)n`);
    expect(await (await handler()).json()).toMatchObject({ allowed: true, overall_attendance: 40, roll_number_slip_threshold: 40 });
    await db.query(`insert into student_attendance_records values('${STUDENT}','${SEMESTER}','absent')`);
    expect(await (await handler()).json()).toMatchObject({ allowed: false, reason: "low_attendance" });
  });
  it("preserves permanent-leave eligibility", async () => {
    await db.query("update students set status='permanent_leave'");
    expect(await (await handler()).json()).toMatchObject({ allowed: true });
  });
  it("does not use another class or closed semester attendance to qualify", async () => {
    await db.query(`update student_attendance_records set semester_id='${id(99)}'`);
    // No current-window marks means protection; unrelated marks cannot end it.
    expect(await (await handler()).json()).toMatchObject({ allowed: true, is_protected: true, overall_attendance: 0 });
  });
  it.each(["active", "permanent_leave"])("allows %s students at 14 evaluable days but not at 15 with low attendance", async (status) => {
    await db.query("update students set status=$1", [status]);
    await db.query("delete from student_attendance_records where attendance_date > '2026-09-15'; update student_attendance_records set status='absent'");
    expect(await (await handler()).json()).toMatchObject({ allowed: true, is_protected: true, protection_days_completed: 14 });
    await db.query(`insert into student_attendance_records values('${STUDENT}','${SEMESTER}','absent','2026-09-16')`);
    expect(await (await handler()).json()).toMatchObject({ allowed: false, reason: "low_attendance" });
  });
  it("uses the reactivation window for protection, not historic marks", async () => {
    await db.query("update students set reactivated_at='2026-09-15'; update student_attendance_records set status='absent'");
    expect(await (await handler()).json()).toMatchObject({ allowed: true, is_protected: true, protection_days_completed: 6 });
  });
});

describe.each([["Mid Term", rollno], ["Clearance", clearance]] as const)("paid fine eligibility: %s", (_title, handler) => {
  it.each(["active", "permanent_leave"])("unblocks low-attendance %s enrollment after full payment", async (status) => {
    await db.query("update students set status=$1", [status]);
    await db.query("update student_attendance_records set status='absent'");
    fine = { semester_id: SEMESTER, paid_amount: 8000, net_amount: 0 };
    expect(await (await handler()).json()).toMatchObject({ allowed: true, overall_attendance: 0 });
  });
  it("keeps the profile photo requirement after payment", async () => {
    fine = { semester_id: SEMESTER, paid_amount: 8000, net_amount: 0 };
    await db.query("update students set profile_image_url=null;update student_attendance_records set status='absent'");
    expect(await (await handler()).json()).toMatchObject({ allowed: false, reason: "missing_profile_photo" });
  });
  it("shows the unpaid balance and reason instead of unblocking partial payment", async () => {
    fine = { semester_id: SEMESTER, paid_amount: 7500, net_amount: 500 };
    await db.query("update student_attendance_records set status='absent'");
    const response = await (await handler()).json();
    expect(response).toMatchObject({ allowed: false, reason: "low_attendance" });
    expect(response.message).toContain("PKR 500");
    expect(response.message).toContain("outside the attendance protection window");
  });
  it("does not use another semester's paid receipt", async () => {
    fine = { semester_id: id(99), paid_amount: 8000, net_amount: 0 };
    await db.query("update student_attendance_records set status='absent'");
    expect(await (await handler()).json()).toMatchObject({ allowed: false, reason: "low_attendance" });
  });
  it("does not bypass inactive enrollment after payment", async () => {
    fine = { semester_id: SEMESTER, paid_amount: 8000, net_amount: 0 };
    await db.query("update students set status='struck_off'");
    const response = await handler();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "STRUCK_OFF", error: expect.stringContaining("reinstatement") });
  });
});

describe("slip-specific content and documents", () => {
  it("keeps the Mid datesheet requirement on the roll-number slip", async () => {
    await db.query("delete from mid_exam_datesheets");
    expect(await (await rollno()).json()).toMatchObject({ allowed: false, reason: "no_datesheet" });
    expect(await (await clearance()).json()).toMatchObject({ allowed: true });
  });
  it("lists all enrolled courses once for clearance, including unscheduled practicals", async () => {
    const data = await (await clearance()).json();
    expect(data.rows).toHaveLength(2);
    expect(data.rows.map((row: { course_code: string }) => row.course_code).sort()).toEqual(["CS101", "CS101P"]);
    expect(data.rows.every((row: { paper_date: string | null }) => row.paper_date === null)).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("student_course_attendance"))).toBe(false);
  });
  it("retains course attendance annotations and scheduled papers for the Mid slip", async () => {
    const data = await (await rollno()).json();
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ course_code: "CS101", paper_date: "2026-10-12", att_percentage: 0 });
  });
  it("fails explicitly if clearance has no current enrolled courses", async () => {
    await db.query("delete from semester_courses");
    expect(await (await clearance()).json()).toMatchObject({ allowed: false, reason: "no_enrolled_courses" });
  });
  it("preserves the matching header, all instructions, and account clearance section", async () => {
    const data: SlipData = await (await clearance()).json();
    const final = buildExamSlipDocument(data, "clearance", "https://example.com", new Date("2026-10-06"));
    const mid = buildExamSlipDocument(data, "rollno", "https://example.com", new Date("2026-10-06"));
    expect(final).toContain("Clearance Slip");
    expect(final).toContain("FINAL TERM EXAMINATION");
    expect(mid).toContain("Roll Number Slip");
    expect(mid).toContain("MID TERM EXAMINATION");
    for (const html of [final, mid]) {
      expect(html.match(/<li>/g)).toHaveLength(6);
      for (const text of ["Account Office Clearance", "Remarks", "Authorized Signature", "Official Stamp", "CS101P", "data-fit-single-page", "Photo"]) expect(html).toContain(text);
    }
    expect(final).toContain("Sr#");
    expect(final).toContain("Course code");
    expect(final).not.toContain("NOT ALLOWED FOR MID EXAM");
    expect(final).not.toContain("Paper Date");
  });
  it("escapes user/course text without changing the input data", async () => {
    const data: SlipData = await (await clearance()).json();
    data.student.name = '<script>alert("bad")</script>';
    data.rows[0].course_title = "Logic & <Networking>";
    const before = JSON.stringify(data);
    const html = buildExamSlipDocument(data, "clearance", "https://example.com");
    expect(html).not.toContain('<script>alert("bad")</script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Logic &amp; &lt;Networking&gt;");
    expect(JSON.stringify(data)).toBe(before);
  });
});
