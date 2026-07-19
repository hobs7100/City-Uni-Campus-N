import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

/** A course is a "lab" if credit_hours = 1 OR course code contains "lab" (case-insensitive). */
const LAB_FILTER = `NOT (co.credit_hours::numeric = 1 OR co.code ILIKE '%Lab%')`;

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const courseId = request.nextUrl.searchParams.get("course_id");
  if (!semesterId || !courseId) {
    return NextResponse.json({ error: "semester_id and course_id are required." }, { status: 400 });
  }

  const semester = await queryOne<Record<string, unknown>>(
    `select s.*, c.class_name, c.session, c.affiliation_id, d.name as department_name,
            a.mid_marks, a.sessional_marks, a.final_marks, a.practical_marks, a.university_name
     from semesters s
     join classes c on c.id = s.class_id
     join departments d on d.id = s.department_id
     left join affiliations a on a.id = c.affiliation_id
     where s.id = $1`,
    [semesterId]
  );
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });

  const course = await queryOne(
    `select co.* from courses co where co.id = $1 and ${LAB_FILTER.replace('co.', 'co.')}`,
    [courseId]
  );
  if (!course) return NextResponse.json({ error: "Course not found or is a lab course." }, { status: 404 });

  const teacherRow = await queryOne<{ teacher_name: string }>(
    `select t.name as teacher_name
     from allocations a
     join allocation_semesters als on als.allocation_id = a.id
     join teachers t on t.id = a.teacher_id
     where als.semester_id = $1 and a.course_id = $2
     limit 1`,
    [semesterId, courseId]
  );

  const students = await query<Record<string, unknown>>(
    `select s.id as student_id, s.name, s.roll_no, s.status,
            r.mid, r.mid_absent, r.re_mid, r.re_mid_absent,
            r.sessional, r.final, r.practical, r.total, r.status as result_status
     from students s
     left join results r on r.student_id = s.id and r.semester_id = $1 and r.course_id = $2
     where s.class_id = $3 and s.deleted_at is null
     order by (s.roll_no is null), s.roll_no, s.name`,
    [semesterId, courseId, semester.class_id]
  );

  const rows = students.map((st: Record<string, unknown>) => {
    const midAbsent = st.mid_absent === true;
    const reMid = st.re_mid !== null && st.re_mid !== undefined ? Number(st.re_mid) : null;
    const reMidAbsent = st.re_mid_absent === true;
    const mid = st.mid !== null && st.mid !== undefined ? Number(st.mid) : Number(semester.mid_marks ?? 0);
    const sessional = st.sessional !== null && st.sessional !== undefined ? Number(st.sessional) : Number(semester.sessional_marks ?? 0);
    const fin = st.final !== null && st.final !== undefined ? Number(st.final) : 0;
    const practical = st.practical !== null && st.practical !== undefined ? Number(st.practical) : 0;
    const effectiveMid = midAbsent ? (reMidAbsent || reMid === null ? 0 : reMid) : mid;
    return {
      student_id: st.student_id,
      name: st.name,
      roll_no: st.roll_no,
      student_status: st.status,
      mid,
      mid_absent: midAbsent,
      re_mid: reMid,
      re_mid_absent: reMidAbsent,
      sessional,
      final: fin,
      practical,
      total: st.total !== null && st.total !== undefined ? Number(st.total) : effectiveMid + sessional + fin + practical,
      status: st.result_status ?? "pass",
    };
  });

  return NextResponse.json({ semester, course, rows, teacher_name: teacherRow?.teacher_name ?? null });
}

const rowSchema = z.object({
  student_id: z.string().uuid(),
  roll_no: z.string().optional().nullable(),
  mid: z.coerce.number().min(0),
  mid_absent: z.boolean().default(false),
  re_mid: z.coerce.number().min(0).nullable().optional(),
  re_mid_absent: z.boolean().default(false),
  sessional: z.coerce.number().min(0),
  final: z.coerce.number().min(0),
  practical: z.coerce.number().min(0).default(0),
  status: z.enum(["pass", "fail", "freezed", "drop"]).default("pass"),
});

const schema = z.object({
  semester_id: z.string().uuid(),
  course_id: z.string().uuid(),
  rows: z.array(rowSchema).min(1),
});

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of d.rows) {
      const midAbsent = row.mid_absent ?? false;
      const reMid = midAbsent ? (row.re_mid ?? null) : null;
      const reMidAbsent = midAbsent ? (row.re_mid_absent ?? false) : false;
      const effectiveMid = midAbsent ? (reMidAbsent || reMid === null ? 0 : reMid) : row.mid;
      const total = effectiveMid + row.sessional + row.final + row.practical;
      if (row.roll_no !== undefined) {
        await client.query(`update students set roll_no = $1 where id = $2`, [row.roll_no || null, row.student_id]);
      }
      await client.query(
        `insert into results
           (student_id, semester_id, course_id, mid, mid_absent, re_mid, re_mid_absent,
            sessional, final, practical, total, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (student_id, semester_id, course_id)
         do update set
           mid = excluded.mid, mid_absent = excluded.mid_absent,
           re_mid = excluded.re_mid, re_mid_absent = excluded.re_mid_absent,
           sessional = excluded.sessional, final = excluded.final,
           practical = excluded.practical, total = excluded.total,
           status = excluded.status, updated_at = now()`,
        [row.student_id, d.semester_id, d.course_id,
         row.mid, midAbsent, reMid, reMidAbsent,
         row.sessional, row.final, row.practical, total, row.status]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true });
}
