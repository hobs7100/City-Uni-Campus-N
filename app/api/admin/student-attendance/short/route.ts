import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { getCoordinatorAttendanceStandings } from "@/lib/coordinator-attendance-standing";
import { getAttendancePolicy } from "@/lib/attendance-policy";
import { runAutoStruckOff } from "@/lib/auto-struck-off";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("admin", "coordinator", "hod");
  if (response) return response;
  const values: unknown[] = [];
  const conditions = ["st.deleted_at is null", "st.status = 'active'"];
  for (const [parameter, column] of [
    ["semester_id", "sem.id"], ["class_id", "st.class_id"], ["department_id", "cl.department_id"],
  ]) {
    const value = request.nextUrl.searchParams.get(parameter);
    if (value) {
      values.push(value);
      conditions.push(`${column} = $${values.length}`);
    }
  }
  if (session?.role === "hod") {
    values.push(session.userId);
    conditions.push(`st.department_id in (select id from departments where hod_id = $${values.length})`);
  }
  const rows = await query<{
    student_id: string; semester_id: string; name: string; father_name: string | null;
    roll_no: string | null; contact: string | null; class_name: string; session: string;
    student_status: string;
  }>(
    `select st.id as student_id, sem.id as semester_id, st.name, st.father_name,
            st.roll_no, st.contact, cl.class_name, cl.session, st.status::text as student_status
     from students st join classes cl on cl.id = st.class_id
     join semesters sem on sem.class_id = st.class_id and sem.status in ('active', 'mid_term')
     where ${conditions.join(" and ")}
     order by cl.class_name, (st.roll_no is null), st.roll_no, st.name`,
    values,
  );
  const bySemester = new Map<string, string[]>();
  for (const row of rows) {
    const ids = bySemester.get(row.semester_id) ?? [];
    ids.push(row.student_id);
    bySemester.set(row.semester_id, ids);
  }
  const standings = await getCoordinatorAttendanceStandings(
    pool, [...bySemester.keys()], rows.map((row) => row.student_id),
  );
  const byStudentSemester = new Map(
    standings.map((standing) => [`${standing.student_id}:${standing.semester_id}`, standing]),
  );
  const students = rows.flatMap((row) => {
    const standing = byStudentSemester.get(`${row.student_id}:${row.semester_id}`)!;
    if (standing.flag !== "struck_off") return [];
    return [{
      ...row, presents: standing.presents, leaves: standing.leaves,
      absents: standing.evaluable_days - standing.presents,
      percentage: standing.percentage, leave_type: standing.leave_type,
      policy_threshold: getAttendancePolicy(standing.leave_type).struckOffBelow,
      is_protected: standing.is_protected,
      protection_days_completed: standing.protection_days_completed,
      protection_days_required: standing.protection_days_required,
      eligible_for_strike_off: standing.eligible_for_strike_off,
    }];
  });
  return NextResponse.json({ students });
}

const strikeSchema = z.object({ student_ids: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("admin", "hod");
  if (response) return response;
  const parsed = strikeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const client = await pool.connect();
  let count = 0;
  try {
    await client.query("begin");
    const selected = await client.query<{
      id: string; semester_id: string; class_id: string;
    }>(
      `select st.id, sem.id as semester_id, st.class_id
       from students st
       join semesters sem on sem.class_id = st.class_id and sem.status in ('active', 'mid_term')
       where st.id = any($1::uuid[]) and st.status = 'active' and st.deleted_at is null
         and ($2::uuid is null or st.department_id in (
           select id from departments where hod_id = $2
         ))
       order by sem.id, st.id`,
      [parsed.data.student_ids, session!.role === "hod" ? session!.userId : null],
    );
    const groups = new Map<string, { studentIds: string[]; classId: string }>();
    for (const student of selected.rows) {
      const group = groups.get(student.semester_id) ?? { studentIds: [], classId: student.class_id };
      group.studentIds.push(student.id);
      groups.set(student.semester_id, group);
    }
    for (const [semesterId, group] of groups) {
      const result = await runAutoStruckOff({
        semesterId, studentIds: group.studentIds, classIds: [group.classId],
        triggeredBy: session!.role === "hod" ? "HOD" : "ADMIN", client,
      });
      count += result.struckOffIds.length;
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return NextResponse.json({ success: true, struck_off_count: count });
}