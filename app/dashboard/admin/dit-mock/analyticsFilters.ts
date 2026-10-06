export type AnalyticsFilters = Record<string, string>;
export type FilterOption = {
  id: string;
  name?: string;
  title?: string;
  code?: string;
  session?: string;
  class_id?: string;
  class_name?: string;
  term_type?: string;
  class_ids?: string[];
  semester_ids?: string[];
  sessions?: string[];
};
export type AnalyticsOptions = Record<string, (FilterOption | string)[]>;
export const analyticsFilterFields = [
  ["class_id", "Class"], ["session", "Session"], ["semester_id", "Semester"],
  ["course_id", "Course"], ["test_series_id", "Test series"],
] as const;

export function filterChoices(data: AnalyticsOptions, key: string, filters: AnalyticsFilters) {
  return (data[key] ?? []).filter((item) => {
    if (typeof item === "string") return true;
    if (key === "class_id") return !filters.session || item.session === filters.session;
    if (key === "semester_id") return (!filters.class_id || item.class_id === filters.class_id)
      && (!filters.session || item.session === filters.session);
    if (key === "course_id") return (!filters.class_id || !item.class_ids || item.class_ids.includes(filters.class_id))
      && (!filters.semester_id || !item.semester_ids || item.semester_ids.includes(filters.semester_id))
      && (!filters.session || !item.sessions || item.sessions.includes(filters.session));
    return true;
  }).map((item) => {
    if (typeof item === "string") return { value: item, label: item };
    const label = key === "semester_id"
      ? `${item.class_name ?? ""} · Semester ${item.name ?? ""} (${item.session ?? ""}${item.term_type ? ` · ${item.term_type}` : ""})`
      : `${item.code ? `${item.code} — ` : ""}${item.name ?? item.title ?? item.id}${item.session ? ` (${item.session})` : ""}`;
    return { value: item.id, label };
  });
}

export function changeAnalyticsFilter(data: AnalyticsOptions, current: AnalyticsFilters, key: string, value: string) {
  const next = { ...current, [key]: value };
  for (const dependent of ["class_id", "semester_id", "course_id"]) {
    if (next[dependent] && !filterChoices(data, dependent, next).some((item) => item.value === next[dependent])) {
      next[dependent] = "";
    }
  }
  return next;
}
