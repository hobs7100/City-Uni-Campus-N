import { NextRequest, NextResponse } from "next/server";
import { getClient, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

function validPaperTime(value: unknown) {
  return value == null || value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}

// GET /api/admin/mid-exam-datesheet?semester_id=...
// Returns all courses for the semester with existing datesheet values pre-filled.
export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const listAll = request.nextUrl.searchParams.get("list") === "all";
  if (listAll) {
    const departmentId = request.nextUrl.searchParams.get("department_id");
    const classId = request.nextUrl.searchParams.get("class_id");
    const session = request.nextUrl.searchParams.get("session");
    const selectedSemesterId = request.nextUrl.searchParams.get("filter_semester_id");
    const conditions: string[] = [];
    const values: string[] = [];
    const add = (sql: string, value: string | null) => {
      if (value) {
        values.push(value);
        conditions.push(`${sql} = $${values.length}`);
      }
    };
    add("d.id", departmentId);
    add("cl.id", classId);
    add("cl.session", session);
    add("s.id", selectedSemesterId);
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const sheets = await query(
      `select med.semester_id, s.semester_number, s.term_type, s.status,
              cl.id as class_id, cl.class_name, cl.session,
              d.id as department_id, d.name as department_name,
              count(*)::int as scheduled_courses,
              min(med.paper_date) as first_paper_date,
              max(med.paper_date) as last_paper_date,
              max(med.updated_at) as updated_at
       from mid_exam_datesheets med
       join semesters s on s.id = med.semester_id
       join classes cl on cl.id = s.class_id
       join departments d on d.id = s.department_id
       ${where}
       group by med.semester_id, s.semester_number, s.term_type, s.status,
                cl.id, cl.class_name, cl.session, d.id, d.name
       order by max(med.updated_at) desc`,
      values,
    );
    return NextResponse.json({ sheets });
  }
  if (!semesterId) {
    return NextResponse.json({ error: "semester_id is required." }, { status: 400 });
  }

  const rows = await query<{
    course_id: string;
    course_code: string;
    course_title: string;
    credit_hours: string;
    teacher_name: string;
    datesheet_id: string | null;
    paper_date: string | null;
    paper_time: string | null;
    bundle_received_date: string | null;
    return_date: string | null;
    result_uploaded: boolean;
  }>(
    `select distinct on (sc.course_id)
       sc.course_id,
       c.code                   as course_code,
       c.title                  as course_title,
       c.credit_hours::text     as credit_hours,
       coalesce(t.name, 'Not Assigned') as teacher_name,
       med.id                   as datesheet_id,
       to_char(med.paper_date,           'YYYY-MM-DD') as paper_date,
       to_char(med.paper_time,           'HH24:MI') as paper_time,
       to_char(med.bundle_received_date, 'YYYY-MM-DD') as bundle_received_date,
       to_char(med.return_date,          'YYYY-MM-DD') as return_date,
       exists (
         select 1 from results r
         where r.semester_id = $1 and r.course_id = sc.course_id
       ) as result_uploaded
     from semester_courses sc
     join courses c on c.id = sc.course_id
     left join allocation_semesters als on als.semester_id = $1
     left join allocations a on a.id = als.allocation_id and a.course_id = sc.course_id
     left join teachers t on t.id = a.teacher_id
     left join mid_exam_datesheets med on med.semester_id = $1 and med.course_id = sc.course_id
     where sc.semester_id = $1
     order by sc.course_id, c.title`,
    [semesterId],
  );

  return NextResponse.json({ rows });
}

// POST /api/admin/mid-exam-datesheet
// Body: { semester_id, rows: [{course_id, paper_date, bundle_received_date, return_date}] }
// Bulk upsert — saves all rows for the semester.
export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.semester_id || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "semester_id and rows[] are required." }, { status: 400 });
  }

  const { semester_id, rows } = body as {
    semester_id: string;
    rows: { course_id: string; paper_date?: string | null; paper_time?: string | null; bundle_received_date?: string | null; return_date?: string | null }[];
  };

  if (rows.length === 0) {
    return NextResponse.json({ saved: 0 });
  }
  if (rows.some((r) => !validPaperTime(r.paper_time) || (r.paper_time && !r.paper_date))) {
    return NextResponse.json({ error: "Paper time must be valid and must have a paper date." }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query("begin");
    for (const r of rows) {
      await client.query(
        `insert into mid_exam_datesheets
           (semester_id, course_id, paper_date, paper_time, bundle_received_date, return_date, updated_at)
         values ($1, $2, $3, $4, $5, $6, now())
         on conflict (semester_id, course_id) do update set
           paper_date           = excluded.paper_date,
            paper_time           = excluded.paper_time,
           bundle_received_date = excluded.bundle_received_date,
           return_date          = excluded.return_date,
           updated_at           = now()`,
        [
          semester_id,
          r.course_id,
          r.paper_date || null,
          r.paper_time || null,
          r.bundle_received_date || null,
          r.return_date || null,
        ],
      );
    }
    await client.query("commit");
    return NextResponse.json({ saved: rows.length });
  } catch (err) {
    await client.query("rollback");
    console.error("mid-exam-datesheet bulk upsert error:", err);
    return NextResponse.json({ error: "Failed to save date sheet." }, { status: 500 });
  } finally {
    client.release();
  }
}

// PATCH /api/admin/mid-exam-datesheet
// Body: { semester_id, course_id, paper_date, bundle_received_date, return_date }
// Single-row upsert.
export async function PATCH(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.semester_id || !body?.course_id) {
    return NextResponse.json({ error: "semester_id and course_id are required." }, { status: 400 });
  }

  const { semester_id, course_id, paper_date, paper_time, bundle_received_date, return_date } = body as {
    semester_id: string;
    course_id: string;
    paper_date?: string | null;
    paper_time?: string | null;
    bundle_received_date?: string | null;
    return_date?: string | null;
  };
  if (!validPaperTime(paper_time) || (paper_time && !paper_date)) {
    return NextResponse.json({ error: "Paper time must be valid and must have a paper date." }, { status: 400 });
  }

  await query(
    `insert into mid_exam_datesheets
       (semester_id, course_id, paper_date, paper_time, bundle_received_date, return_date, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (semester_id, course_id) do update set
       paper_date           = excluded.paper_date,
       paper_time           = excluded.paper_time,
       bundle_received_date = excluded.bundle_received_date,
       return_date          = excluded.return_date,
       updated_at           = now()`,
    [semester_id, course_id, paper_date || null, paper_time || null, bundle_received_date || null, return_date || null],
  );

  return NextResponse.json({ ok: true });
}
