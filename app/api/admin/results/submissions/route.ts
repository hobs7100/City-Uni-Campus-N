import { NextRequest, NextResponse } from "next/server";
import { getClient, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// ── GET  /api/admin/results/submissions ──────────────────────────────────────
// Admin/coordinator: all departments.  HoD: their department only.
export async function GET() {
  const { session, response } = await requireRole("admin", "coordinator", "hod");
  if (response) return response;

  // Determine optional department filter for HoD
  let deptClause = "";
  const params: unknown[] = [];
  if (session!.role === "hod") {
    const hodDept = await queryOne<{ id: string }>(
      `select id from departments where hod_id = $1`,
      [session!.userId]
    );
    if (!hodDept) return NextResponse.json({ submissions: [] });
    params.push(hodDept.id);
    deptClause = `and d.id = $${params.length}`;
  }

  const submissions = await query<{
    semester_id: string;
    course_id: string;
    course_code: string;
    course_title: string;
    teacher_name: string | null;
    semester_number: number;
    term_type: string;
    class_id: string;
    class_name: string;
    session: string;
    department_id: string;
    department_name: string;
    status: string;
    submitted_at: string | null;
    student_count: number;
  }>(
    `select * from (
       select distinct on (sc.semester_id, sc.course_id)
         sc.semester_id,
         sc.course_id,
         c.code                  as course_code,
         c.title                 as course_title,
         (
           select t.name
           from teachers t
           join allocations a2     on a2.teacher_id  = t.id
           join allocation_semesters als2 on als2.allocation_id = a2.id
           where als2.semester_id = sc.semester_id and a2.course_id = sc.course_id
           limit 1
         )                       as teacher_name,
         sem.semester_number,
         sem.term_type,
         cl.id                   as class_id,
         cl.class_name,
         cl.session,
         d.id                    as department_id,
         d.name                  as department_name,
         coalesce(rs.status, 'submitted') as status,
         to_char(rs.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as submitted_at,
         (select count(*)::int from results r
          where r.semester_id = sc.semester_id and r.course_id = sc.course_id) as student_count
       from semester_courses sc
       join courses c   on c.id   = sc.course_id
       join semesters sem on sem.id = sc.semester_id
       join classes cl  on cl.id  = sem.class_id
       join departments d on d.id = cl.department_id
       left join result_submissions rs
         on rs.semester_id = sc.semester_id and rs.course_id = sc.course_id
       where exists (
         select 1 from results r
         where r.semester_id = sc.semester_id and r.course_id = sc.course_id
       )
       ${deptClause}
       order by sc.semester_id, sc.course_id
     ) sub
     order by submitted_at desc nulls last, course_title`,
    params
  );

  return NextResponse.json({ submissions });
}

// ── DELETE  /api/admin/results/submissions ────────────────────────────────────
// Body: { semester_id, course_id }
// Deletes all result rows for that course+semester and resets submission status → "pending".
export async function DELETE(request: NextRequest) {
  const { session, response } = await requireRole("admin", "coordinator", "hod");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const { semester_id, course_id } = body ?? {};
  if (!semester_id || !course_id)
    return NextResponse.json({ error: "semester_id and course_id are required." }, { status: 400 });

  // HoD: verify this course belongs to their department
  if (session!.role === "hod") {
    const check = await queryOne<{ ok: boolean }>(
      `select exists (
         select 1
         from semester_courses sc
         join semesters sem on sem.id = sc.semester_id
         join classes cl    on cl.id  = sem.class_id
         join departments d on d.id   = cl.department_id
         where sc.semester_id = $1 and sc.course_id = $2 and d.hod_id = $3
       ) as ok`,
      [semester_id, course_id, session!.userId]
    );
    if (!check?.ok)
      return NextResponse.json({ error: "Not authorized for this course." }, { status: 403 });
  }

  const client = await getClient();
  try {
    await client.query("begin");

    // Delete individual student results
    await client.query(
      `delete from results where semester_id = $1 and course_id = $2`,
      [semester_id, course_id]
    );

    // Reset (or create) submission record → pending
    await client.query(
      `insert into result_submissions (semester_id, course_id, status, submitted_at)
       values ($1, $2, 'pending', null)
       on conflict (semester_id, course_id) do update
         set status = 'pending', submitted_at = null, updated_at = now()`,
      [semester_id, course_id]
    );

    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("rollback");
    console.error("result submissions delete error:", err);
    return NextResponse.json({ error: "Failed to delete results." }, { status: 500 });
  } finally {
    client.release();
  }
}
