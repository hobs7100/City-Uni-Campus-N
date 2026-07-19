import { NextRequest, NextResponse } from "next/server";
import { getClient, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/admin/re-mid-exam-datesheet?semester_id=...
// Returns all courses for the semester that have at least one mid-absent student,
// with existing re-mid datesheet values pre-filled.
export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const semesterId = request.nextUrl.searchParams.get("semester_id");
  if (!semesterId) {
    return NextResponse.json({ error: "semester_id is required." }, { status: 400 });
  }

  const rows = await query<{
    course_id: string;
    course_code: string;
    course_title: string;
    credit_hours: string;
    teacher_name: string;
    absent_count: number;
    datesheet_id: string | null;
    paper_date: string | null;
    bundle_received_date: string | null;
    return_date: string | null;
  }>(
    `select distinct on (sc.course_id)
       sc.course_id,
       c.code                   as course_code,
       c.title                  as course_title,
       c.credit_hours::text     as credit_hours,
       coalesce(t.name, 'Not Assigned') as teacher_name,
       (
         select count(*) from results r
         where r.semester_id = $1 and r.course_id = sc.course_id and r.mid_absent = true
       )::int                   as absent_count,
       rmd.id                   as datesheet_id,
       to_char(rmd.paper_date,           'YYYY-MM-DD') as paper_date,
       to_char(rmd.bundle_received_date, 'YYYY-MM-DD') as bundle_received_date,
       to_char(rmd.return_date,          'YYYY-MM-DD') as return_date
     from semester_courses sc
     join courses c on c.id = sc.course_id
     left join allocation_semesters als on als.semester_id = $1 and als.course_id = sc.course_id
     left join allocations a on a.id = als.allocation_id
     left join teachers t on t.id = a.teacher_id
     left join re_mid_exam_datesheets rmd on rmd.semester_id = $1 and rmd.course_id = sc.course_id
     where sc.semester_id = $1
       and exists (
         select 1 from results r
         where r.semester_id = $1 and r.course_id = sc.course_id and r.mid_absent = true
       )
     order by sc.course_id, c.title`,
    [semesterId],
  );

  return NextResponse.json({ rows });
}

// POST /api/admin/re-mid-exam-datesheet
// Body: { semester_id, rows: [{course_id, paper_date, bundle_received_date, return_date}], notify?: boolean }
// Bulk upsert. When notify=true also fans out notifications to mid-absent students & their teachers & HOD.
export async function POST(request: NextRequest) {
  const { session: sess, response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.semester_id || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "semester_id and rows[] are required." }, { status: 400 });
  }

  const { semester_id, rows, notify = false } = body as {
    semester_id: string;
    rows: { course_id: string; paper_date?: string | null; bundle_received_date?: string | null; return_date?: string | null }[];
    notify?: boolean;
  };

  if (rows.length === 0) return NextResponse.json({ saved: 0 });

  const client = await getClient();
  try {
    await client.query("begin");

    // Upsert datesheet rows
    for (const r of rows) {
      await client.query(
        `insert into re_mid_exam_datesheets
           (semester_id, course_id, paper_date, bundle_received_date, return_date, updated_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (semester_id, course_id) do update set
           paper_date           = excluded.paper_date,
           bundle_received_date = excluded.bundle_received_date,
           return_date          = excluded.return_date,
           updated_at           = now()`,
        [semester_id, r.course_id, r.paper_date || null, r.bundle_received_date || null, r.return_date || null],
      );
    }

    if (notify) {
      // Collect course ids that have a paper_date set
      const courseIds = rows.filter((r) => r.paper_date).map((r) => r.course_id);

      if (courseIds.length > 0) {
        // Fetch semester info for message text
        const semRow = await client.query(
          `select s.semester_number, s.term_type, cl.class_name, cl.session
           from semesters s join classes cl on cl.id = s.class_id
           where s.id = $1`,
          [semester_id],
        );
        const sem = semRow.rows[0] as { semester_number: number; term_type: string; class_name: string; session: string } | undefined;
        const semLabel = sem ? `${sem.class_name} (${sem.session}) – Semester ${sem.semester_number} ${sem.term_type}` : "active semester";

        // Mid-absent students for those courses
        const studentRows = await client.query<{ student_id: string; course_title: string; paper_date: string | null }>(
          `select distinct r.student_id,
                  c.title as course_title,
                  to_char(rmd.paper_date, 'DD Mon YYYY') as paper_date
           from results r
           join courses c on c.id = r.course_id
           left join re_mid_exam_datesheets rmd on rmd.semester_id = r.semester_id and rmd.course_id = r.course_id
           where r.semester_id = $1
             and r.course_id = any($2::uuid[])
             and r.mid_absent = true`,
          [semester_id, courseIds],
        );

        // Teachers allocated to those courses
        const teacherRows = await client.query<{ teacher_id: string }>(
          `select distinct a.teacher_id
           from allocation_semesters als
           join allocations a on a.id = als.allocation_id
           where als.semester_id = $1 and als.course_id = any($2::uuid[])`,
          [semester_id, courseIds],
        );

        // HOD of the semester's department
        const hodRow = await client.query<{ hod_id: string | null }>(
          `select d.hod_id
           from semesters s
           join classes cl on cl.id = s.class_id
           join departments d on d.id = cl.department_id
           where s.id = $1
           limit 1`,
          [semester_id],
        );
        const hodId = hodRow.rows[0]?.hod_id ?? null;

        const title = "Re-Mid Exam Date Sheet Published";

        type NRow = ["student" | "teacher" | "user", string, string];
        const notifRows: NRow[] = [
          ...studentRows.rows.map((r): NRow => [
            "student",
            r.student_id,
            `Re-Mid exam for ${r.course_title} is scheduled on ${r.paper_date ?? "TBD"}. (${semLabel})`,
          ]),
          ...teacherRows.rows.map((r): NRow => [
            "teacher",
            r.teacher_id,
            `Re-Mid Exam Date Sheet has been published for ${semLabel}. Please check the schedule.`,
          ]),
          ...(hodId
            ? [["user", hodId, `Re-Mid Exam Date Sheet has been published for ${semLabel}.`] as NRow]
            : []),
        ];

        if (notifRows.length > 0) {
          const types    = notifRows.map(([type]) => type);
          const ids      = notifRows.map(([, id]) => id);
          const messages = notifRows.map(([, , msg]) => msg);

          // Fan-out individually so each gets a personalised message
          for (let i = 0; i < notifRows.length; i++) {
            await client.query(
              `insert into notifications (recipient_type, recipient_id, title, message)
               values ($1::text::notification_recipient_type, $2, $3, $4)`,
              [types[i], ids[i], title, messages[i]],
            );
          }
        }

        // Record the broadcast
        await client.query(
          `insert into notification_broadcasts
             (department_id, class_id, session, notification_date, subject, body, recipient_count, created_by)
           select cl.department_id, s.class_id, cl.session, now()::date,
                  $2, $3, $4, $5
           from semesters s join classes cl on cl.id = s.class_id
           where s.id = $1`,
          [
            semester_id,
            title,
            `Re-Mid Exam Date Sheet published for ${semLabel}.`,
            notifRows.length,
            sess!.userId,
          ],
        );
      }
    }

    await client.query("commit");
    return NextResponse.json({ saved: rows.length });
  } catch (err) {
    await client.query("rollback");
    console.error("re-mid-exam-datesheet bulk upsert error:", err);
    return NextResponse.json({ error: "Failed to save date sheet." }, { status: 500 });
  } finally {
    client.release();
  }
}

// PATCH /api/admin/re-mid-exam-datesheet
// Body: { semester_id, course_id, paper_date, bundle_received_date, return_date }
// Single-row upsert (no notification).
export async function PATCH(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.semester_id || !body?.course_id) {
    return NextResponse.json({ error: "semester_id and course_id are required." }, { status: 400 });
  }

  const { semester_id, course_id, paper_date, bundle_received_date, return_date } = body as {
    semester_id: string;
    course_id: string;
    paper_date?: string | null;
    bundle_received_date?: string | null;
    return_date?: string | null;
  };

  await query(
    `insert into re_mid_exam_datesheets
       (semester_id, course_id, paper_date, bundle_received_date, return_date, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (semester_id, course_id) do update set
       paper_date           = excluded.paper_date,
       bundle_received_date = excluded.bundle_received_date,
       return_date          = excluded.return_date,
       updated_at           = now()`,
    [semester_id, course_id, paper_date || null, bundle_received_date || null, return_date || null],
  );

  return NextResponse.json({ ok: true });
}
