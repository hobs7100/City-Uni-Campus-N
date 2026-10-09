interface ProgressClass {
  id: string;
  class_name: string;
  status: string;
  type: string;
  total_semesters: number;
}

interface ProgressSemester {
  class_id: string;
  semester_number: number;
  status: string;
}

/** Keep the Start Semester eligibility rules shared with its progress display. */
export function buildSemesterTimelines<C extends ProgressClass, S extends ProgressSemester>(
  classes: readonly C[],
  semesters: readonly S[],
) {
  return classes
    .filter((classInfo) => classInfo.status === "active")
    .map((classInfo) => {
      const classSemesters = semesters
        .filter((semester) => semester.class_id === classInfo.id)
        .sort((a, b) => a.semester_number - b.semester_number);
      // Preserve the existing view's exclusion of classes in an active semester,
      // but include new classes so their first semester can be started.
      if (classSemesters.some((semester) => semester.status === "active")) return null;

      const semesterByNumber = new Map(
        classSemesters.map((semester) => [semester.semester_number, semester]),
      );
      const runningSemester = classSemesters.find((semester) => semester.status !== "closed");
      const firstSemester = classInfo.type === "BS-Bridging" ? 5 : 1;
      const nextSemesterNumber = classSemesters.reduce(
        (highest, semester) => Math.max(highest, semester.semester_number),
        firstSemester - 1,
      ) + 1;

      const steps = Array.from({ length: classInfo.total_semesters }, (_, index) => {
        const number = firstSemester + index;
        const semester = semesterByNumber.get(number) ?? null;
        const isNext = number === nextSemesterNumber;
        const isReady = isNext && !runningSemester;
        return {
          number,
          semester,
          state: semester
            ? semester.status === "closed"
              ? "completed"
              : "current"
            : isReady
              ? "ready"
              : isNext && runningSemester
                ? "blocked"
                : "locked",
        } as const;
      });

      return { classInfo, steps, runningSemester, isNewClass: classSemesters.length === 0 };
    })
    .filter((timeline): timeline is NonNullable<typeof timeline> => timeline !== null)
    .sort((a, b) => a.classInfo.class_name.localeCompare(b.classInfo.class_name));
}

/** Match all search words across class, session, semester and related details. */
export function matchesSemesterSearch(
  search: string,
  values: readonly (string | number | null | undefined)[],
) {
  const normalize = (value: string) => value.toLowerCase().replace(/[_-]/g, " ");
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  const text = normalize(values.filter((value) => value != null).join(" "));
  return words.every((word) => text.includes(word));
}
