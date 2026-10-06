import { ditGradeFromPercentage } from "@/lib/dit-grades";
import { zone, type ResultRow } from "./_lib";

/** Weighted overall result for the tests selected by the analytics filters. */
export function studentResults(rows: ResultRow[]) {
  const grouped = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const records = grouped.get(row.student_id) ?? [];
    records.push(row);
    grouped.set(row.student_id, records);
  }
  return [...grouped.values()].map((records) => {
    const first = records[0];
    const total_obtained = records.reduce((sum, row) => sum + (row.is_absent ? 0 : Number(row.obtained_marks)), 0);
    const total_marks = records.reduce((sum, row) => sum + Number(row.total_marks), 0);
    const percentage = total_marks ? total_obtained / total_marks * 100 : 0;
    return {
      student_id: first.student_id, name: first.student_name, student_name: first.student_name,
      father_name: first.father_name, roll_no: first.roll_no, class_id: first.class_id,
      class_name: first.class_name, class: first.class_name, session: first.session,
      semester_id: first.semester_id, semester_number: first.semester_number, term_type: first.term_type,
      total_obtained, total_marks, percentage, overall_percentage: percentage,
      grade: ditGradeFromPercentage(percentage), zone: zone(percentage), test_count: records.length,
    };
  }).sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
}
