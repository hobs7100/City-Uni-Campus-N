import { NextRequest, NextResponse } from "next/server";
import { getClient, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

type DatesheetRow = {
  course_id: string;
  paper_date?: string | null;
  paper_time?: string | null;
  bundle_received_date?: string | null;
  return_date?: string | null;
};

function validId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function validDate(value: unknown) {
  if (value == null || value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validPaperTime(value: unknown) {
  return value == null || value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}

function validRow(row: DatesheetRow) {
  return Boolean(row && typeof row.course_id === "string" && row.course_id.trim()) &&
    validDate(row.paper_date) &&
    validDate(row.bundle_received_date) &&
    validDate(row.return_date) &&
    validPaperTime(row.paper_time) &&
    (!row.paper_time || Boolean(row.paper_date));
}

// GET /api/admin/mock-exam-datesheet?semester_id=...
// Returns all semester courses with saved Mock Exam date-sheet values.
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
              min(med.created_at)::date as created_date,
              max(med.updated_at) as updated_at
       from mock_exam_datesheets med
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

  const rows = await query(
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
       to_char(med.return_date,          'YYYY-MM-DD') as return_date
     from semester_courses sc
     join courses c on c.id = sc.course_id
     left join allocation_semesters als on als.semester_id = $1
     left join allocations a on a.id = als.allocation_id and a.course_id = sc.course_id
     left join teachers t on t.id = a.teacher_id
     left join mock_exam_datesheets med on med.semester_id = $1 and med.course_id = sc.course_id
     where sc.semester_id = $1
     order by sc.course_id, c.title`,
    [semesterId],
  );
  return NextResponse.json({ rows });
}

// DELETE /api/admin/mock-exam-datesheet?semester_id=...
export async function DELETE(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const semesterId = request.nextUrl.searchParams.get("semester_id");
  if (!semesterId) {
    return NextResponse.json({ error: "semester_id is required." }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const semester = await client.query(
      `select s.id
       from semesters s
       where s.id = $1
       for update`,
      [semesterId],
    );
    if (semester.rowCount !== 1) {
      await client.query("rollback");
      return NextResponse.json({ error: "Semester not found." }, { status: 404 });
    }
    const deleted = await client.query(
      `delete from mock_exam_datesheets
       where semester_id = $1
       returning id`,
      [semesterId],
    );
    if (deleted.rowCount === 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "No saved date sheet exists for this class semester." }, { status: 404 });
    }
    await client.query("commit");
    return NextResponse.json({ deleted: deleted.rowCount });
  } catch (error) {
    await client.query("rollback");
    console.error("mock-exam-datesheet delete error:", error);
    return NextResponse.json({ error: "Failed to delete the complete date sheet." }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST /api/admin/mock-exam-datesheet
// Body: { semester_id, rows: [{course_id, paper_date, paper_time, bundle_received_date, return_date}] }
export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.semester_id || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "semester_id and rows[] are required." }, { status: 400 });
  }
  const semesterId = body.semester_id as string;
  const rows = body.rows as DatesheetRow[];
  if (rows.length === 0) return NextResponse.json({ saved: 0 });
  if (!validId(semesterId) ||
      rows.some((row) => !validRow(row) || !validId(row.course_id)) ||
      new Set(rows.map((row) => row.course_id)).size !== rows.length) {
    return NextResponse.json({ error: "Rows must have unique course IDs, valid dates, and valid paper times. Paper time requires a paper date." }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const semester = await client.query("select id from semesters where id = $1 for update", [semesterId]);
    if (semester.rowCount !== 1) {
      await client.query("rollback");
      return NextResponse.json({ error: "Semester not found." }, { status: 404 });
    }
    const membership = await client.query(
      `select course_id from semester_courses
       where semester_id = $1 and course_id = any($2::uuid[])`,
      [semesterId, rows.map((row) => row.course_id)],
    );
    if (membership.rowCount !== rows.length) {
      await client.query("rollback");
      return NextResponse.json({ error: "Every course must belong to the selected semester." }, { status: 400 });
    }
    for (const row of rows) {
      await client.query(
        `insert into mock_exam_datesheets
           (semester_id, course_id, paper_date, paper_time, bundle_received_date, return_date, updated_at)
         values ($1, $2, $3, $4, $5, $6, now())
         on conflict (semester_id, course_id) do update set
           paper_date = excluded.paper_date,
           paper_time = excluded.paper_time,
           bundle_received_date = excluded.bundle_received_date,
           return_date = excluded.return_date,
           updated_at = now()`,
        [
          semesterId,
          row.course_id,
          row.paper_date || null,
          row.paper_time || null,
          row.bundle_received_date || null,
          row.return_date || null,
        ],
      );
    }
    await client.query("commit");
    return NextResponse.json({ saved: rows.length });
  } catch (error) {
    await client.query("rollback");
    console.error("mock-exam-datesheet bulk upsert error:", error);
    return NextResponse.json({ error: "Failed to save date sheet." }, { status: 500 });
  } finally {
    client.release();
  }
}

// PATCH /api/admin/mock-exam-datesheet
// Body: { semester_id, course_id, paper_date, paper_time, bundle_received_date, return_date }
export async function PATCH(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.semester_id || !body?.course_id) {
    return NextResponse.json({ error: "semester_id and course_id are required." }, { status: 400 });
  }
  const row: DatesheetRow = body;
  const { semester_id, course_id, paper_date, paper_time, bundle_received_date, return_date } = body as {
    semester_id: string;
    course_id: string;
    paper_date?: string | null;
    paper_time?: string | null;
    bundle_received_date?: string | null;
    return_date?: string | null;
  };
  if (!validId(semester_id) || !validId(course_id) || !validRow(row)) {
    return NextResponse.json({ error: "Dates must be valid and paper time must be valid and have a paper date." }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const semester = await client.query("select id from semesters where id = $1 for update", [semester_id]);
    if (semester.rowCount !== 1) {
      await client.query("rollback");
      return NextResponse.json({ error: "Semester not found." }, { status: 404 });
    }
    const membership = await client.query(
      "select 1 from semester_courses where semester_id = $1 and course_id = $2",
      [semester_id, course_id],
    );
    if (membership.rowCount !== 1) {
      await client.query("rollback");
      return NextResponse.json({ error: "Course does not belong to the selected semester." }, { status: 400 });
    }
    await client.query(
      `insert into mock_exam_datesheets
         (semester_id, course_id, paper_date, paper_time, bundle_received_date, return_date, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (semester_id, course_id) do update set
         paper_date = excluded.paper_date,
         paper_time = excluded.paper_time,
         bundle_received_date = excluded.bundle_received_date,
         return_date = excluded.return_date,
         updated_at = now()`,
      [semester_id, course_id, paper_date || null, paper_time || null, bundle_received_date || null, return_date || null],
    );
    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    console.error("mock-exam-datesheet single-row upsert error:", error);
    return NextResponse.json({ error: "Failed to save date sheet." }, { status: 500 });
  } finally {
    client.release();
  }
}