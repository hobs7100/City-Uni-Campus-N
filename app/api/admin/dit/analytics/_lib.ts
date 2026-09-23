import { z } from "zod";
import { query } from "@/lib/db";

export const uuid = z.string().uuid();
export const zoneSchema = z.enum(["toppers", "good", "average", "warning", "danger"]);
export const scopeSchema = z.enum(["subject", "overall"]);
export type Zone = z.infer<typeof zoneSchema>;

export function dates(from?: string | null, to?: string | null) {
  return { from: from || "1900-01-01", to: to || "9999-12-31" };
}
export function validDateRange(from: string, to: string) { return from <= to; }
export function zone(pct: number): Zone {
  if (pct >= 90) return "toppers";
  if (pct >= 80) return "good";
  if (pct >= 60) return "average";
  if (pct >= 50) return "warning";
  return "danger";
}

export type ResultRow = {
  id: string; student_id: string; student_name: string; father_name: string | null; roll_no: string | null;
  class_id: string; class_name: string; session: string; semester_id: string; semester_number: number; term_type: string;
  course_id: string; course_code: string; course_title: string; test_series_id: string; series_name: string;
  test_date: string; obtained_marks: number; total_marks: number; passing_marks: number; is_absent: boolean;
};

export async function resultRows(p: {
  from: string; to: string; testSeriesId?: string | null; classId?: string | null;
  semesterId?: string | null; courseId?: string | null; studentId?: string | null;
  session?: string | null;
}) {
  const args: unknown[] = [p.from, p.to]; const where = ["cl.type='DIT'", "s.deleted_at is null", "dmr.test_date >= $1", "dmr.test_date <= $2"];
  const add = (value: unknown, sql: string) => { if (value) { args.push(value); where.push(sql.replace("?", `$${args.length}`)); } };
  add(p.testSeriesId, "dmr.test_series_id = ?"); add(p.classId, "cl.id = ?"); add(p.semesterId, "dmr.semester_id = ?");
  add(p.courseId, "co.id = ?"); add(p.studentId, "dmr.student_id = ?"); add(p.session, "cl.session = ?");
  return query<ResultRow>(`select dmr.id, s.id student_id, s.name student_name, s.father_name, s.roll_no,
    cl.id class_id, cl.class_name, cl.session, sem.id semester_id, sem.semester_number, sem.term_type,
    co.id course_id, co.code course_code, co.title course_title, ts.id test_series_id, ts.name series_name,
    dmr.test_date::text test_date, case when dmr.is_absent then 0 else dmr.obtained_marks end obtained_marks,
    ts.total_marks, ts.passing_marks, dmr.is_absent
    from dit_mock_results dmr join students s on s.id=dmr.student_id
    join dit_test_series ts on ts.id=dmr.test_series_id join allocations a on a.id=dmr.allocation_id
    join courses co on co.id=a.course_id join semesters sem on sem.id=dmr.semester_id join classes cl on cl.id=sem.class_id
    where ${where.join(" and ")} order by dmr.test_date, co.title, s.name`, args);
}

export function effective(p: Record<string, string | null>, from: string, to: string) {
  return { from_date: from, to_date: to, test_series_id: p.test_series_id || null, class_id: p.class_id || null,
    semester_id: p.semester_id || null, course_id: p.course_id || null };
}

export async function analyticsFilterOptions() {
  const [classes, semesters, courses, series] = await Promise.all([
    query<{ id:string; name:string; session:string }>(
      `select id, class_name as name, session from classes where type='DIT' order by session desc, class_name`
    ),
    query<{ id:string; name:string; term_type:string; class_id:string; class_name:string; session:string }>(
      `select sem.id, sem.semester_number::text as name, sem.term_type, cl.id as class_id,
              cl.class_name, cl.session
       from semesters sem join classes cl on cl.id=sem.class_id
       where cl.type='DIT'
       order by cl.session desc, cl.class_name, sem.semester_number`
    ),
    query<{ id:string; title:string; code:string }>(
      `select distinct co.id, co.title, co.code
       from allocations a
       join courses co on co.id=a.course_id
       join allocation_semesters asem on asem.allocation_id=a.id
       join semesters sem on sem.id=asem.semester_id
       join classes cl on cl.id=sem.class_id
       where cl.type='DIT'
       order by co.title, co.code`
    ),
    query<{ id:string; name:string }>(
      `select id, name from dit_test_series order by created_at desc`
    ),
  ]);
  return {
    class_id: classes,
    session: [...new Set(classes.map((item) => item.session))],
    semester_id: semesters,
    course_id: courses,
    test_series_id: series,
  };
}