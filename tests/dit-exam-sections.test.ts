import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";

let db: Pool;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = id(1), teacher = id(2), allocation = id(3), semester = id(4), classId = id(5);
const student = id(6), other = id(7), nonDit = id(8), series = id(9), red = id(10), green = id(11);
let role = "admin";
let studentIdentity = student;
vi.mock("@/lib/db", () => ({
  pool: { connect: () => db.connect() },
  query: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows,
  queryOne: async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows[0] ?? null,
}));
vi.mock("@/lib/requireRole", () => {
  const check = async (...roles: string[]) => roles.includes(role)
    ? { session: { userId: role === "teacher" ? teacher : role === "student" ? studentIdentity : admin, role }, response: null }
    : { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  return { requireRole: check, requireExactRole: check };
});
import { GET as sectionsGET, POST as sectionsPOST } from "../app/api/admin/dit/exam-sections/route";
import { POST as movePOST } from "../app/api/admin/dit/exam-sections/assign/route";
import { GET as rosterGET } from "../app/api/admin/dit/exam-sections/students/route";
import { GET as historyGET } from "../app/api/admin/dit/exam-sections/history/route";
import { GET as teacherSectionsGET } from "../app/api/teacher/dit/exam-sections/route";
import { GET as resultGET, POST as resultPOST } from "../app/api/teacher/dit/results/route";
import { GET as subjectsGET } from "../app/api/admin/dit/analytics/route";
import { GET as zonesGET } from "../app/api/admin/dit/analytics/zones/route";
import { GET as percentageGET } from "../app/api/admin/dit/analytics/percentage-range/route";
import { GET as bulkGET } from "../app/api/admin/dit/analytics/bulk-report/route";
import { GET as reportGET } from "../app/api/admin/dit/analytics/student-report/route";
import { GET as searchGET } from "../app/api/admin/dit/analytics/student-search/route";
import { assignDitExamSection } from "../lib/dit-exam-sections";
import { resultReportContent } from "../app/dashboard/admin/dit-mock/ReportPrint";
import { GET as adminStudentsGET } from "../app/api/admin/students/route";
import { GET as studentResultsGET } from "../app/api/student/dit/results/route";
import { GET as testSeriesGET } from "../app/api/admin/dit/test-series/route";
import { POST as announceMidPOST } from "../app/api/admin/dit/test-series/[id]/announce-mid/route";
import { announceDitMidResult, DIT_STUDENT_RESULT_VISIBILITY } from "../lib/dit-mid-result-announcement";

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
  dir = mkdtempSync(join(tmpdir(), "dit-exam-sections-pg-"));
  execFileSync("initdb", ["-D", dir, "-A", "trust", "-U", "dit_test"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", dir, "-o", `-h 127.0.0.1 -k ${dir} -p ${port} -F`,
    "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" });
  started = true;
  db = new Pool({ host: "127.0.0.1", port, user: "dit_test", database: "postgres" });
  await db.query(`
    create table users(id uuid primary key,name text);
    create table teachers(id uuid primary key,name text);
    create table courses(id uuid primary key,code text,title text);
    create table classes(id uuid primary key,type text,class_name text,session text,status text);
    create table semesters(id uuid primary key,class_id uuid,status text,semester_number int,term_type text);
    create table allocations(id uuid primary key,teacher_id uuid,course_id uuid,status text);
    create table allocation_semesters(allocation_id uuid,semester_id uuid);
    create table students(id uuid primary key,class_id uuid,status text,deleted_at timestamptz,
      name text,father_name text,roll_no text,profile_image_url text,session text);
    create table student_course_attendance(student_id uuid,allocation_id uuid,marked_by uuid,status text);
    create table student_attendance_records(student_id uuid,attendance_date date,status text);
    create table departments(id uuid primary key,name text);
    alter table students add column cnic text, add column contact text, add column address text,
      add column email text, add column department_id uuid, add column status_change_date date,
      add column status_change_semester int, add column status_changed_by_name text,
      add column created_at timestamptz default now();
    insert into departments values('${id(40)}','Computing');
    insert into users values('${admin}','Demo Admin');
    insert into teachers values('${teacher}','Demo Teacher');
    insert into courses values('${id(12)}','C1','Computing');
    insert into classes values('${classId}','DIT','Registered DIT Class','2026','active'),
      ('${id(13)}','BS','BS Class','2026','active');
    insert into semesters values('${semester}','${classId}','active',1,'Regular');
    insert into allocations values('${allocation}','${teacher}','${id(12)}','active');
    insert into allocation_semesters values('${allocation}','${semester}');
    insert into students(id,class_id,status,name,roll_no,session) values
      ('${student}','${classId}','active','Student One','1','2026'),
      ('${other}','${classId}','active','Student Two','2','2026'),
      ('${nonDit}','${id(13)}','active','BS Student','3','2026');
    insert into student_attendance_records values('${student}','2026-10-01','present');
    update students set department_id='${id(40)}';
  `);
  await db.query(readFileSync("db/migrations/023_dit_mock_exam.sql", "utf8"));
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(readFileSync("db/migrations/068_dit_result_no_duplicates.sql", "utf8"));
    await client.query(readFileSync("db/migrations/069_dit_exam_sections.sql", "utf8"));
    await client.query(readFileSync("db/migrations/070_dit_mid_result_announcement.sql", "utf8"));
    await client.query("commit");
  } finally { client.release(); }
  await db.query(`insert into dit_test_series(id,name,total_marks,passing_marks)
    values('${series}','Mock One',100,40),('${id(14)}','Mock Two',100,40),
      ('${id(50)}','Mid-Term',100,40),('${id(51)}',' mid-term ',100,40);`);
}, 30000);
afterAll(async () => {
  await db?.end();
  if (started) execFileSync("pg_ctl", ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const get = (path: string, params: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/${path}?${new URLSearchParams(params)}`);
const post = (path: string, body: unknown) => new NextRequest(`http://localhost/api/${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const move = (section: string, ids = [student]) => movePOST(post("admin/dit/exam-sections/assign",
  { exam_section_id: section, student_ids: ids }));
const result = (ids = [student], examSectionId?: string, testSeries = series) => resultPOST(post("teacher/dit/results", {
  allocation_id: allocation, semester_id: semester, test_series_id: testSeries,
  test_date: "2026-10-10", ...(examSectionId ? { exam_section_id: examSectionId } : {}),
  rows: ids.map((student_id) => ({ student_id, obtained_marks: 90 })),
}));
const query = async (sql: string, args?: unknown[]) => (await db.query(sql, args)).rows;

describe("exam-only DIT sections", () => {
  beforeEach(async () => {
    role = "admin";
    studentIdentity = student;
    await db.query("truncate dit_mock_results,dit_exam_section_history,dit_exam_section_memberships,dit_exam_sections cascade");
    await db.query("update dit_test_series set mid_result_announced_at=null,mid_result_announced_by=null");
    await db.query(`insert into dit_exam_sections(id,name,date,created_by) values
      ('${red}','Red','2026-10-01','${admin}'),('${green}','Green','2026-10-01','${admin}')`);
  });

  it("creates dated sections and rejects duplicate names or invalid dates", async () => {
    const response = await sectionsPOST(post("admin/dit/exam-sections", { name: "Super Section", date: "2026-10-15" }));
    expect(response.status).toBe(201);
    expect((await response.json()).section).toMatchObject({ name: "Super Section", date: "2026-10-15" });
    expect((await sectionsPOST(post("admin/dit/exam-sections", { name: " red ", date: "2026-10-15" }))).status).toBe(409);
    expect((await sectionsPOST(post("admin/dit/exam-sections", { name: "Blue", date: "2026-02-30" }))).status).toBe(400);
  });

  it("loads the parent DIT student selector with real bound filter parameters", async () => {
    const cases: Record<string, string>[] = [
      { class_type: "DIT" },
      { class_type: "DIT", class_id: classId, department_id: id(40), status: "active" },
    ];
    for (const params of cases) {
      const response = await adminStudentsGET(get("admin/students", params));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.students.map((s: { id: string }) => s.id).sort()).toEqual([student, other].sort());
    }
  });

  it("moves current membership, updates counters, and preserves parent class and attendance", async () => {
    expect((await move(red, [student, other])).status).toBe(200);
    expect((await move(red)).status).toBe(200); // No duplicate/no-op history.
    expect((await move(green)).status).toBe(200);
    const counts = (await (await sectionsGET()).json()).sections;
    expect(counts.find((s: { id: string }) => s.id === red).student_count).toBe(1);
    expect(counts.find((s: { id: string }) => s.id === green).student_count).toBe(1);
    const old = await (await rosterGET(get("admin/dit/exam-sections/students", { exam_section_id: red }))).json();
    expect(old.students.map((s: { id: string }) => s.id)).toEqual([other]);
    expect((await query("select class_id from students where id=$1", [student]))[0].class_id).toBe(classId);
    expect(await query("select * from student_attendance_records")).toHaveLength(1);
    const h = await (await historyGET(get("admin/dit/exam-sections/history", { student_id: student }))).json();
    expect(h.history).toHaveLength(2);
    expect(h.history[0]).toMatchObject({ from_section_name: "Red", to_section_name: "Green", changed_by_name: "Demo Admin" });
    expect(await query("select * from dit_exam_section_memberships where student_id=$1", [student])).toHaveLength(1);
  });

  it("rejects a mixed non-DIT batch atomically and enforces admin-only mutation", async () => {
    expect((await move(red, [student, nonDit])).status).toBe(400);
    expect(await query("select * from dit_exam_section_memberships")).toHaveLength(0);
    expect((await move(red, [student, student])).status).toBe(400);
    role = "teacher";
    expect((await move(red)).status).toBe(403);
    expect((await sectionsPOST(post("admin/dit/exam-sections", { name: "Blue", date: "2026-10-15" }))).status).toBe(403);
  });

  it("preserves recorded result section across moves and updates, with legacy results unmodified", async () => {
    role = "teacher";
    expect((await result()).status).toBe(200);
    expect((await query("select exam_section_id from dit_mock_results"))[0].exam_section_id).toBeNull();
    role = "admin"; await move(red);
    role = "teacher";
    expect((await result([student], red, id(14))).status).toBe(200);
    role = "admin"; await move(green);
    role = "teacher";
    expect((await result([student], green, id(14))).status).toBe(200);
    const rows = await query("select test_series_id,exam_section_id from dit_mock_results order by test_series_id");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.test_series_id === id(14)).exam_section_id).toBe(red);
    expect(rows.find((r) => r.test_series_id === series).exam_section_id).toBeNull();
    role = "admin";
    const h = await (await historyGET(get("admin/dit/exam-sections/history", { student_id: student }))).json();
    expect(h.results.find((r: { series_name: string }) => r.series_name === "Mock Two").exam_section_name).toBe("Red");
  });

  it("filters teacher entry and refuses a stale or spoofed section roster", async () => {
    await move(red); await move(green, [other]);
    role = "teacher";
    const roster = await (await resultGET(get("teacher/dit/results", {
      allocation_id: allocation, semester_id: semester, test_series_id: series,
      test_date: "2026-10-10", exam_section_id: red,
    }))).json();
    expect(roster.students.map((s: { student_id: string }) => s.student_id)).toEqual([student]);
    const sections = await (await teacherSectionsGET(get("teacher/dit/exam-sections", { semester_id: semester }))).json();
    expect(sections.sections).toHaveLength(2);
    expect((await result([other], red)).status).toBe(409);
    role = "admin"; await move(green);
    role = "teacher";
    expect((await result([student], red)).status).toBe(409);
    expect(await query("select * from dit_mock_results")).toHaveLength(0);
  });

  it("applies exam-section filters to every analytics API, search, and bulk student info", async () => {
    await move(red); await move(green, [other]);
    role = "teacher"; expect((await result([student, other])).status).toBe(200);
    role = "admin";
    const p = { exam_section_id: red };
    const subjects = await (await subjectsGET(get("admin/dit/analytics", p))).json();
    expect(subjects.summary.unique_student_count).toBe(1);
    expect(subjects.filter_options.exam_section_id).toHaveLength(2);
    const zones = await (await zonesGET(get("admin/dit/analytics/zones", p))).json();
    expect(zones.rows.map((s: { student_id: string }) => s.student_id)).toEqual([student]);
    const range = await (await percentageGET(get("admin/dit/analytics/percentage-range", p))).json();
    expect(range.students.map((s: { student_id: string }) => s.student_id)).toEqual([student]);
    const search = await (await searchGET(get("admin/dit/analytics/student-search", { ...p, q: "Student" }))).json();
    expect(search.students.map((s: { id: string }) => s.id)).toEqual([student]);
    const individual = await (await reportGET(get("admin/dit/analytics/student-report", { ...p, student_id: student }))).json();
    expect(individual.student.exam_section_name).toBe("Red");
    const bulk = await (await bulkGET(get("admin/dit/analytics/bulk-report", {
      ...p, class_id: classId, semester_id: semester, session: "2026",
      from_date: "2026-10-01", to_date: "2026-10-31",
    }))).json();
    expect(bulk.reports).toHaveLength(1);
    expect(bulk.reports[0].student.exam_section_name).toBe("Red");
    expect(bulk.reports[0].class.name).toBe("Registered DIT Class");
    expect(bulk.reports[0].attendance_weeks[0].presents).toBe(1);
    const printed = resultReportContent(bulk.reports[0]);
    expect(printed).toContain("<b>Exam Section:</b> Red");
    expect(printed).toContain("Registered DIT Class");
    expect(resultReportContent({ ...bulk.reports[0], student: { ...bulk.reports[0].student, exam_section_name: "<Red>" } }))
      .toContain("&lt;Red&gt;");
  });

  it("rolls demo assignments, history, results and section creation back together", async () => {
    const client = await db.connect();
    try {
      await client.query("begin");
      await client.query("insert into dit_exam_sections(id,name,date,created_by) values($1,'Rollback Demo',current_date,$2)", [id(20), admin]);
      await assignDitExamSection(client, [student], id(20), admin);
      await assignDitExamSection(client, [student], green, admin);
      expect((await client.query("select count(*)::int n from dit_exam_section_history")).rows[0].n).toBe(2);
      await client.query("rollback");
    } finally { client.release(); }
    expect(await query("select * from dit_exam_section_memberships")).toHaveLength(0);
    expect(await query("select * from dit_exam_section_history")).toHaveLength(0);
    expect(await query("select * from dit_exam_sections where id=$1", [id(20)])).toHaveLength(0);
  });

  it("serializes concurrent moves and never keeps membership in two sections", async () => {
    expect((await Promise.all([move(red), move(green)])).map((r) => r.status)).toEqual([200, 200]);
    expect(await query("select * from dit_exam_section_memberships where student_id=$1", [student])).toHaveLength(1);
    expect(await query("select * from dit_exam_section_history where student_id=$1", [student])).toHaveLength(2);
  });

  const announce = (seriesId = id(50)) => announceMidPOST(post("admin/dit/test-series/announce-mid", {}), {
    params: Promise.resolve({ id: seriesId }),
  });

  it("hides teacher-uploaded Mid-Term marks, chart data and filter options until admin announces", async () => {
    role = "teacher";
    expect((await result([student], undefined, id(50))).status).toBe(200);
    const teacherView = await resultGET(get("teacher/dit/results", {
      allocation_id: allocation, semester_id: semester, test_series_id: id(50), test_date: "2026-10-10",
    }));
    expect((await teacherView.json()).students[0].obtained_marks).toBe(90);
    role = "student";
    for (const filters of [{}, { test_series_id: id(50), month: "10", year: "2026" }]) {
      const hidden = await studentResultsGET(get("student/dit/results", filters as Record<string, string>));
      expect(hidden.status).toBe(200);
      expect(hidden.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await hidden.json()).toEqual({ results: [], series_list: [], courses: [] });
    }
    role = "admin";
    const seriesData = await (await testSeriesGET()).json();
    expect(seriesData.can_announce_mid_result).toBe(true);
    expect(seriesData.series.find((s: { id: string }) => s.id === id(50)).mid_result_announced_at).toBeNull();
    expect((await announce()).status).toBe(200);
    role = "student";
    const released = await (await studentResultsGET(get("student/dit/results"))).json();
    expect(released.results).toHaveLength(1);
    expect(released.results[0]).toMatchObject({ test_series_name: "Mid-Term", obtained_marks: 90 });
    expect(released.series_list).toEqual([{ id: id(50), name: "Mid-Term" }]);
    expect(released.courses).toHaveLength(1);
  });

  it("keeps other test series visible, isolates students, and rejects non-DIT access", async () => {
    role = "teacher";
    await result([student], undefined, series);
    await result([student], undefined, id(51));
    role = "student";
    const data = await (await studentResultsGET(get("student/dit/results"))).json();
    expect(data.results.map((r: { test_series_id: string }) => r.test_series_id)).toEqual([series]);
    expect(data.series_list.map((s: { id: string }) => s.id)).toEqual([series]);
    studentIdentity = other;
    expect((await (await studentResultsGET(get("student/dit/results"))).json()).results).toEqual([]);
    studentIdentity = nonDit;
    expect((await studentResultsGET(get("student/dit/results"))).status).toBe(403);
  });

  it.each(["teacher", "student", "assistant", "coordinator", "hod"])("does not let %s announce results", async denied => {
    role = denied;
    expect((await announce()).status).toBe(403);
    expect((await query("select mid_result_announced_at from dit_test_series where id=$1", [id(50)]))[0]
      .mid_result_announced_at).toBeNull();
  });

  it("validates announcements and preserves the original audit record on repeated/concurrent clicks", async () => {
    expect((await announce("invalid")).status).toBe(400);
    expect((await announce(id(99))).status).toBe(404);
    expect((await announce(series)).status).toBe(400);
    const releases = await Promise.all([announce(), announce()]);
    expect(releases.map(r => r.status)).toEqual([200, 200]);
    const first = (await releases[0].json()).announcement;
    const second = (await releases[1].json()).announcement;
    expect(first.mid_result_announced_at).toBe(second.mid_result_announced_at);
    expect(first.mid_result_announced_by).toBe(admin);
    expect((await (await announce()).json()).announcement).toEqual(first);
  });

  it("rolls back a demo upload and announcement together without changing registration or attendance", async () => {
    const client = await db.connect();
    const demoId = id(90);
    try {
      await client.query("begin");
      await client.query("insert into dit_test_series(id,name,total_marks,passing_marks) values($1,'Mid-Term',100,40)", [demoId]);
      await client.query(`insert into dit_mock_results(test_series_id,allocation_id,semester_id,student_id,test_date,obtained_marks,submitted_by)
        values($1,$2,$3,$4,'2026-10-10',80,$5)`, [demoId, allocation, semester, student, teacher]);
      const visibleCount = async () => (await client.query(`select count(*)::int n
        from dit_mock_results dmr join dit_test_series ts on ts.id=dmr.test_series_id
        where ts.id=$1 and ${DIT_STUDENT_RESULT_VISIBILITY}`, [demoId])).rows[0].n;
      expect(await visibleCount()).toBe(0);
      await announceDitMidResult(client, demoId, admin);
      expect(await visibleCount()).toBe(1);
    } finally { await client.query("rollback"); client.release(); }
    expect(await query("select id from dit_test_series where id=$1", [demoId])).toEqual([]);
    expect(await query("select id from dit_mock_results where test_series_id=$1", [demoId])).toEqual([]);
    expect((await query("select class_id from students where id=$1", [student]))[0].class_id).toBe(classId);
    expect(await query("select * from student_attendance_records")).toHaveLength(1);
  });
});
