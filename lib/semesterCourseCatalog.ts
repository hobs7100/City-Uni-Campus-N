interface CatalogCourse {
  id: string;
  code: string;
  title: string;
  credit_hours: string | number;
  department_name?: string;
  status: string;
}

// Semester curricula use the full campus catalog, regardless of the class's
// department or program. Only courses already in this curriculum are omitted.
export function semesterCourseOptions(courses: readonly CatalogCourse[], existingIds: readonly string[] = []) {
  const existing = new Set(existingIds);
  return courses
    .filter((course) => !existing.has(course.id))
    .map((course) => ({
      value: course.id,
      label: `${course.code} — ${course.title} (${course.credit_hours} Cr)${course.department_name ? ` — ${course.department_name}` : ""}${course.status === "blocked" ? " [Blocked]" : ""}`,
    }));
}
