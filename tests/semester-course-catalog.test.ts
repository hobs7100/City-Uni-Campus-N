import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { semesterCourseOptions } from "@/lib/semesterCourseCatalog";

const { queryOne, clientQuery, permission } = vi.hoisted(() => ({
  queryOne: vi.fn(),
  clientQuery: vi.fn(),
  permission: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  queryOne,
  query: vi.fn(),
  pool: { connect: async () => ({ query: clientQuery, release: vi.fn() }) },
}));
vi.mock("@/lib/portalPermissions", () => ({ requirePortalPermission: permission }));
vi.mock("@/lib/requireRole", () => ({ requireRole: vi.fn() }));
import { POST as addCourse } from "../app/api/admin/semesters/[id]/courses/route";
import { POST as startSemester } from "../app/api/admin/semesters/route";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const catalog = [
  { id: id(1), code: "CS101", title: "Programming", department_id: id(10), department_name: "Computing", credit_hours: "3", status: "active" },
  { id: id(2), code: "ENG101", title: "English", department_id: id(11), department_name: "English", credit_hours: "2", status: "active" },
  { id: id(3), code: "OLD101", title: "Archived subject", department_id: id(12), department_name: "Business", credit_hours: "3", status: "blocked" },
];
const request = (body: unknown) => new NextRequest("http://test/api", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const add = (course_id = id(2)) => addCourse(request({ course_id }), { params: Promise.resolve({ id: id(20) }) });

beforeEach(() => {
  vi.resetAllMocks();
  permission.mockResolvedValue({ response: null });
});

describe("full semester course catalog", () => {
  it("includes every department and every catalog entry when starting any class's semester", () => {
    const options = semesterCourseOptions(catalog);
    expect(options.map((option) => option.value)).toEqual(catalog.map((course) => course.id));
    expect(options[0].label).toContain("Computing");
    expect(options[1].label).toContain("English");
    expect(options[2].label).toContain("[Blocked]");
    expect(options[0].label).toContain("CS101 — Programming (3 Cr)");
  });

  it("only excludes courses already in the edited semester, without mutating the full catalog", () => {
    expect(semesterCourseOptions(catalog, [id(1)]).map((option) => option.value)).toEqual([id(2), id(3)]);
    expect(semesterCourseOptions(catalog)).toHaveLength(3);
    expect(catalog).toHaveLength(3);
  });

  it("keeps same-code courses from different departments distinguishable and separately selectable", () => {
    const options = semesterCourseOptions([catalog[0], { ...catalog[1], code: "CS101", title: "Programming" }]);
    expect(options[0].value).not.toBe(options[1].value);
    expect(options[0].label).not.toBe(options[1].label);
  });

  it.each(["active", "mid_term", "final_term"])("adds a cross-department course to a %s semester", async (status) => {
    queryOne.mockResolvedValueOnce({ id: id(20), status, department_id: id(10) })
      .mockResolvedValueOnce({ id: id(2), department_id: id(11) })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: id(30) });
    const response = await add();
    expect(response.status).toBe(201);
    expect(queryOne).toHaveBeenLastCalledWith(expect.stringContaining("insert into semester_courses"), [id(20), id(2)]);
  });

  it("starts a semester with selected courses from the full catalog, retaining their original ids", async () => {
    queryOne.mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ total_semesters: 8, type: "BS", starting_semester: 1 })
      .mockResolvedValueOnce({ latest_semester_number: null });
    clientQuery.mockResolvedValue({ rows: [] });
    clientQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes("insert into semesters") ? [{ id: id(20), status: "active" }] : [],
    }));
    const response = await startSemester(request({
      department_id: id(10), class_id: id(21), semester_number: 1,
      term_type: "Fall", start_date: "2026-10-20", course_ids: catalog.map((course) => course.id),
    }));
    expect(response.status).toBe(201);
    for (const course of catalog) {
      expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining("insert into semester_courses"), [id(20), course.id]);
    }
    expect(clientQuery).toHaveBeenCalledWith("commit");
  });

  it("continues rejecting duplicate curriculum entries", async () => {
    queryOne.mockResolvedValueOnce({ id: id(20), status: "active" })
      .mockResolvedValueOnce({ id: id(2) }).mockResolvedValueOnce({ exists: true });
    expect((await add()).status).toBe(409);
    expect(queryOne).toHaveBeenCalledTimes(3);
  });

  it("continues protecting closed semesters", async () => {
    queryOne.mockResolvedValueOnce({ id: id(20), status: "closed" });
    expect((await add()).status).toBe(409);
    expect(queryOne).toHaveBeenCalledTimes(1);
  });

  it("continues rejecting missing courses and semesters", async () => {
    queryOne.mockResolvedValueOnce(null);
    expect((await add()).status).toBe(404);
    queryOne.mockResolvedValueOnce({ id: id(20), status: "active" }).mockResolvedValueOnce(null);
    expect((await add()).status).toBe(404);
  });

  it("preserves the semester edit permission check", async () => {
    permission.mockResolvedValueOnce({ response: new Response(null, { status: 403 }) });
    expect((await add()).status).toBe(403);
    expect(queryOne).not.toHaveBeenCalled();
  });
});
