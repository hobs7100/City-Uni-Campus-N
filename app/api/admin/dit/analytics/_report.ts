import { ditGradeFromPercentage } from "@/lib/dit-grades";
import { effective, zone, type ResultRow } from "./_lib";

export type AttendanceWeek = { month: string; week: number; presents: number; absents: number; leaves: number };
export type ReportIdentity = { id: string; name: string; father_name: string | null; roll_no: string | null; profile_image_url: string | null; class_name: string; session: string };
export type ReportContext = { class_id: string; class_name: string; session: string; semester_id: string; semester_number: number; term_type: string };

export function assembleStudentReport(
  rows: ResultRow[],
  identity: ReportIdentity,
  attendance_weeks: AttendanceWeek[],
  context: ReportContext,
  raw: Record<string, string>,
  from: string,
  to: string,
) {
  const monthlyAttendance = new Map<string, { month: string; presents: number; absents: number; leaves: number }>();
  for (const row of attendance_weeks) {
    const point = monthlyAttendance.get(row.month) ?? { month: row.month, presents: 0, absents: 0, leaves: 0 };
    point.presents += row.presents;
    point.absents += row.absents;
    point.leaves += row.leaves;
    monthlyAttendance.set(row.month, point);
  }
  const monthlyResults = new Map<string, { month: string; obtained: number; total: number; tests: number }>();
  for (const row of rows) {
    const month = row.test_date.slice(0, 7);
    const point = monthlyResults.get(month) ?? { month, obtained: 0, total: 0, tests: 0 };
    point.obtained += row.obtained_marks;
    point.total += row.total_marks;
    point.tests++;
    monthlyResults.set(month, point);
  }
  const courses = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const group = courses.get(row.course_id) ?? [];
    group.push(row);
    courses.set(row.course_id, group);
  }
  const course_rows = [...courses.values()].map((rs) => {
    const r = rs[0];
    const obtained_marks = rs.reduce((sum, x) => sum + x.obtained_marks, 0);
    const total_marks = rs.reduce((sum, x) => sum + x.total_marks, 0);
    const percentage = total_marks ? obtained_marks / total_marks * 100 : 0;
    return { course_id: r.course_id, course_title: r.course_title, course_code: r.course_code,
      tests: rs, obtained_marks, total_marks, percentage, grade: ditGradeFromPercentage(percentage), zone: zone(percentage) };
  }).sort((a, b) => a.course_title.localeCompare(b.course_title) || a.course_code.localeCompare(b.course_code) || a.course_id.localeCompare(b.course_id));
  const obtained = rows.reduce((sum, row) => sum + row.obtained_marks, 0);
  const total = rows.reduce((sum, row) => sum + row.total_marks, 0);
  const percentage = total ? obtained / total * 100 : 0;
  const test_rows = rows.slice().sort((a, b) =>
    a.course_title.localeCompare(b.course_title) || a.course_code.localeCompare(b.course_code) ||
    a.test_date.localeCompare(b.test_date) || a.series_name.localeCompare(b.series_name)
  ).map((x, i) => {
    const score = x.total_marks ? x.obtained_marks / x.total_marks * 100 : 0;
    return { test_number: i + 1, date: x.test_date, subject_id: x.course_id, course_id: x.course_id,
      course_code: x.course_code, course_title: x.course_title, series_name: x.series_name,
      obtained_marks: x.obtained_marks, total_marks: x.total_marks, series: x.series_name,
      obtained: x.obtained_marks, total: x.total_marks, percentage: score,
      grade: x.is_absent ? "Absent" : ditGradeFromPercentage(score), is_absent: x.is_absent };
  });
  const section = identity.class_name.toLowerCase().includes("digital leaders") ? "A" :
    identity.class_name.toLowerCase().includes("digital innovators") ? "B" : null;
  const grade = rows.length ? ditGradeFromPercentage(percentage) : "—";
  return {
    student: identity, profile_image_url: identity.profile_image_url, section,
    class: { id: context.class_id, name: context.class_name, session: context.session, section },
    semester: { id: context.semester_id, number: context.semester_number, term_type: context.term_type },
    effective_filters: { ...effective(raw, from, to), session: raw.session || null },
    from_date: from, to_date: to, courses: course_rows, test_rows,
    attendance_months: [...monthlyAttendance.values()], attendance_weeks,
    result_months: [...monthlyResults.values()].sort((a, b) => a.month.localeCompare(b.month)),
    report_generated_at: new Date().toISOString(), no_results: rows.length === 0,
    grand_totals: { obtained, total, percentage, obtained_marks: obtained, total_marks: total,
      overall_percentage: percentage, grade, zone: rows.length ? zone(percentage) : null },
  };
}