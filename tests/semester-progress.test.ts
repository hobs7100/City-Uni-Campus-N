import { describe, expect, it } from "vitest";
import { buildSemesterTimelines, matchesSemesterSearch } from "@/lib/semesterProgress";

const newClass = {
  id: "new-class",
  class_name: "BS Computer Science",
  session: "2026-2030",
  department_id: "computing",
  type: "BS",
  status: "active",
  total_semesters: 8,
};

const semester = (semester_number: number, status = "closed", class_id = newClass.id) => ({
  id: `semester-${class_id}-${semester_number}`,
  class_id,
  semester_number,
  status,
});

describe("Start Semester progress", () => {
  it("includes a new class with no semester records and enables only Semester 1", () => {
    const [timeline] = buildSemesterTimelines([newClass], []);
    expect(timeline.classInfo).toBe(newClass);
    expect(timeline.isNewClass).toBe(true);
    expect(timeline.runningSemester).toBeUndefined();
    expect(timeline.steps).toHaveLength(8);
    expect(timeline.steps[0]).toEqual({ number: 1, semester: null, state: "ready" });
    expect(timeline.steps.slice(1).every((step) => step.state === "locked")).toBe(true);
  });

  it.each(["ADP", "DIT", "LLB"])("starts a new %s class at Semester 1", (type) => {
    const [timeline] = buildSemesterTimelines([{ ...newClass, type, total_semesters: 4 }], []);
    expect(timeline.steps.map((step) => step.number)).toEqual([1, 2, 3, 4]);
    expect(timeline.steps[0].state).toBe("ready");
  });

  it("starts a new BS-Bridging class at Semester 5 and locks Semesters 6–8", () => {
    const [timeline] = buildSemesterTimelines([
      { ...newClass, type: "BS-Bridging", total_semesters: 4 },
    ], []);
    expect(timeline.steps.map((step) => step.number)).toEqual([5, 6, 7, 8]);
    expect(timeline.steps.map((step) => step.state)).toEqual(["ready", "locked", "locked", "locked"]);
  });

  it("does not use another class's semester history for a new class", () => {
    const [timeline] = buildSemesterTimelines([newClass], [semester(1, "active", "other-class")]);
    expect(timeline.isNewClass).toBe(true);
    expect(timeline.steps[0].state).toBe("ready");
  });

  it("preserves the next sequential semester after closed semesters", () => {
    const [timeline] = buildSemesterTimelines([newClass], [semester(2), semester(1)]);
    expect(timeline.isNewClass).toBe(false);
    expect(timeline.steps.map((step) => step.state)).toEqual([
      "completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked",
    ]);
  });

  it.each(["mid_term", "final_term"])("keeps the next step blocked during %s", (status) => {
    const current = semester(2, status);
    const [timeline] = buildSemesterTimelines([newClass], [semester(1), current]);
    expect(timeline.runningSemester).toBe(current);
    expect(timeline.steps[1].state).toBe("current");
    expect(timeline.steps[2].state).toBe("blocked");
    expect(timeline.steps.some((step) => step.state === "ready")).toBe(false);
  });

  it("preserves the existing exclusion of classes with active semesters", () => {
    expect(buildSemesterTimelines([newClass], [semester(1, "active")])).toEqual([]);
  });

  it("does not show blocked classes even when they have no semester history", () => {
    expect(buildSemesterTimelines([{ ...newClass, status: "blocked" }], [])).toEqual([]);
  });

  it("does not enable a semester beyond the program's final semester", () => {
    const [timeline] = buildSemesterTimelines(
      [{ ...newClass, total_semesters: 2 }],
      [semester(1), semester(2)],
    );
    expect(timeline.steps.map((step) => step.state)).toEqual(["completed", "completed"]);
  });

  it("preserves Bridging progression after Semester 5 closes", () => {
    const [timeline] = buildSemesterTimelines(
      [{ ...newClass, type: "BS-Bridging", total_semesters: 4 }],
      [semester(5)],
    );
    expect(timeline.steps.map((step) => step.state)).toEqual(["completed", "ready", "locked", "locked"]);
  });

  it("sorts new and existing classes together without mutating source arrays", () => {
    const alpha = { ...newClass, id: "alpha", class_name: "ADP English" };
    const classes = [newClass, alpha];
    const history = [semester(2), semester(1)];
    expect(buildSemesterTimelines(classes, history).map((timeline) => timeline.classInfo.id))
      .toEqual(["alpha", newClass.id]);
    expect(classes[0]).toBe(newClass);
    expect(history[0].semester_number).toBe(2);
  });
});

describe("Semester search", () => {
  const values = [
    newClass.class_name, newClass.session, newClass.type, "Computing",
    "Semester 1", "New class", "Ready to start", "Fall", "mid_term",
    "CS101", "Programming Fundamentals", "2026-10-09",
  ];

  it.each([
    "computer science", "2026-2030", "semester 1", "COMPUTING",
    "new class", "ready", "fall", "mid-term", "CS101", "programming", "2026-10-09",
  ])("matches related details: %s", (search) => {
    expect(matchesSemesterSearch(search, values)).toBe(true);
  });

  it("matches multiple words across different fields regardless of their order", () => {
    expect(matchesSemesterSearch("  FALL   2026   science ", values)).toBe(true);
  });

  it("keeps all eligible classes when the query is cleared", () => {
    expect(matchesSemesterSearch("", values)).toBe(true);
    expect(matchesSemesterSearch("   ", values)).toBe(true);
  });

  it("returns no match for unrelated classes and requires every search word", () => {
    expect(matchesSemesterSearch("law", values)).toBe(false);
    expect(matchesSemesterSearch("science law", values)).toBe(false);
  });

  it("handles missing optional semester details for new classes", () => {
    expect(matchesSemesterSearch("new", [null, undefined, "New class", 1])).toBe(true);
  });
});
