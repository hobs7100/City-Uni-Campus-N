/** Program numbering is independent of the first semester managed on campus. */
export function semesterBounds(type: string, totalSemesters: number) {
  return { minimum: type === "BS-Bridging" ? 5 : 1, maximum: type === "BS-Bridging" ? 8 : totalSemesters };
}

export function nextClassSemester(type: string, totalSemesters: number, startingSemester?: number, latestSemester?: number | null) {
  const { minimum } = semesterBounds(type, totalSemesters);
  return Math.max(startingSemester ?? minimum, (latestSemester ?? minimum - 1) + 1);
}
