/**
 * GET /api/hod/warning-list
 * Returns active students in the HoD's departments whose current-semester
 * coordinator-marked attendance is in their applicable warning zone
 * (regular: 60 % ≤ pct < 75 %; active partial leave: 30 % ≤ pct < 40 %).
 * Also returns `days_in_warning`: the number of evaluable (present/absent)
 * school days since the student's attendance last fell below 75 %.
 *
 * POST /api/hod/warning-list
 * Strikes off a single student and inserts a notification for them.
 * Body: { student_id: UUID }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const departments = await query<{ id: string }>(
    `select id from departments where hod_id = $1`,
    [session!.userId]
  );
  const deptIds = departments.map((d) => d.id);
  if (deptIds.length === 0) return NextResponse.json({ students: [] });

  const rows = await query<{
    student_id: string;
    name: string;
    roll_no: string | null;
    class_name: string;
    session: string;
    department_name: string;
    presents: string;
    absents: string;
    percentage: string;
    days_in_warning: string;
    leave_type: "permanent" | "partial";
    warning_below: string;
  }>(
    `WITH dept_students AS (
       SELECT s.id  AS student_id, s.name, s.roll_no,
              cl.class_name, cl.session,
              sem.id AS semester_id,
               d.name AS department_name,
               CASE WHEN EXISTS (
                 SELECT 1 FROM student_leaves sl
                 WHERE sl.student_id = s.id
                   AND sl.revoked_at IS NULL
                   AND sl.leave_type = 'partial'
               ) THEN 'partial'::varchar ELSE 'permanent'::varchar END AS leave_type
       FROM   students s
       JOIN   classes cl     ON cl.id  = s.class_id
       JOIN   departments d  ON d.id   = s.department_id
       JOIN   semesters sem  ON sem.class_id = cl.id AND sem.status = 'active'
       WHERE  d.id = ANY($1::uuid[])
         AND  s.deleted_at IS NULL
         AND  s.status     = 'active'
     ),
     records AS (
        SELECT sar.student_id, sar.attendance_date, sar.status, ds.leave_type
       FROM   student_attendance_records sar
       JOIN   dept_students ds
              ON  ds.student_id  = sar.student_id
              AND ds.semester_id = sar.semester_id
       WHERE  sar.status IN ('present', 'absent')
     ),
     running AS (
        SELECT student_id, attendance_date, leave_type,
              SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)
                OVER w AS cum_p,
              SUM(CASE WHEN status = 'absent'  THEN 1 ELSE 0 END)
                OVER w AS cum_a
       FROM   records
       WINDOW w AS (PARTITION BY student_id ORDER BY attendance_date
                    ROWS UNBOUNDED PRECEDING)
     ),
     running_pct AS (
       SELECT *,
              ROUND(cum_p::numeric / NULLIF(cum_p + cum_a, 0) * 100) AS pct
       FROM   running
     ),
     last_ok AS (
        -- Last date cumulative pct was still at or above the applicable policy boundary.
       SELECT student_id, MAX(attendance_date) AS last_ok_date
       FROM   running_pct
         WHERE pct >= CASE WHEN leave_type = 'partial' THEN 40 ELSE 75 END
       GROUP  BY student_id
     ),
     current_totals AS (
       -- Most-recent cumulative totals per student
       SELECT DISTINCT ON (student_id)
               student_id, cum_p, cum_a, pct, leave_type
       FROM   running_pct
       ORDER  BY student_id, attendance_date DESC
     ),
     warning_counts AS (
        -- Evaluable days since the student last met their applicable policy boundary.
       SELECT r.student_id, COUNT(*) AS days_in_warning
       FROM   records r
       LEFT   JOIN last_ok lo ON lo.student_id = r.student_id
       WHERE  r.attendance_date > COALESCE(lo.last_ok_date, '1900-01-01'::date)
       GROUP  BY r.student_id
     )
     SELECT ds.student_id,  ds.name,    ds.roll_no,
            ds.class_name,  ds.session, ds.department_name,
            ct.cum_p::int   AS presents,
            ct.cum_a::int   AS absents,
            ct.pct          AS percentage,
             COALESCE(wc.days_in_warning, 0)::int AS days_in_warning,
             ds.leave_type,
              CASE WHEN ds.leave_type = 'partial' THEN 40 ELSE 75 END AS warning_below
     FROM   dept_students  ds
     JOIN   current_totals ct  ON ct.student_id = ds.student_id
     LEFT   JOIN warning_counts wc ON wc.student_id = ds.student_id
     WHERE  ct.pct IS NOT NULL
         AND ct.pct >= CASE WHEN ds.leave_type = 'partial' THEN 30 ELSE 60 END
         AND ct.pct < CASE WHEN ds.leave_type = 'partial' THEN 40 ELSE 75 END
     ORDER  BY wc.days_in_warning DESC NULLS LAST, ct.pct ASC`,
    [deptIds]
  );

  const students = rows.map((r) => ({
    student_id:    r.student_id,
    name:          r.name,
    roll_no:       r.roll_no,
    class_name:    r.class_name,
    session:       r.session,
    department_name: r.department_name,
    presents:      Number(r.presents),
    absents:       Number(r.absents),
    percentage:    Number(r.percentage),
    days_in_warning: Number(r.days_in_warning),
    leave_type: r.leave_type,
    policy_threshold: Number(r.warning_below),
  }));

  return NextResponse.json({ students });
}

const strikeSchema = z.object({ student_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = strikeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const departments = await query<{ id: string }>(
    `select id from departments where hod_id = $1`,
    [session!.userId]
  );
  const deptIds = departments.map((d) => d.id);

  const stuCheck = await query<{
    id: string; name: string; leave_type: "permanent" | "partial"; warning_below: number;
  }>(
    `select s.id, s.name,
            case when exists (
              select 1 from student_leaves sl
              where sl.student_id = s.id
                and sl.revoked_at is null
                and sl.leave_type = 'partial'
            ) then 'partial'::varchar else 'permanent'::varchar end as leave_type,
            case when exists (
              select 1 from student_leaves sl
              where sl.student_id = s.id
                and sl.revoked_at is null
                and sl.leave_type = 'partial'
             ) then 40 else 75 end as warning_below
     from students s
     join semesters sem on sem.class_id = s.class_id and sem.status = 'active'
     left join student_attendance_records sar
       on sar.student_id = s.id and sar.semester_id = sem.id
     where s.id = $1
       and s.department_id = any($2::uuid[])
       and s.deleted_at is null
       and s.status = 'active'
     group by s.id
     having count(*) filter (where sar.status in ('present', 'absent')) > 0
       and count(*) filter (where sar.status = 'present')::float /
           nullif(count(*) filter (where sar.status in ('present', 'absent')), 0)
           >= case when exists (
             select 1 from student_leaves sl
             where sl.student_id = s.id
               and sl.revoked_at is null
               and sl.leave_type = 'partial'
            ) then 0.3 else 0.6 end
       and count(*) filter (where sar.status = 'present')::float /
           nullif(count(*) filter (where sar.status in ('present', 'absent')), 0)
           < case when exists (
             select 1 from student_leaves sl
             where sl.student_id = s.id
               and sl.revoked_at is null
               and sl.leave_type = 'partial'
            ) then 0.4 else 0.75 end`,
    [parsed.data.student_id, deptIds]
  );
  if (stuCheck.length === 0) {
    return NextResponse.json(
      { error: "Student is not currently in the applicable attendance warning zone." },
      { status: 400 }
    );
  }

  const student = stuCheck[0];
  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query(
      `update students
       set status                 = 'struck_off',
           status_changed_by_name = 'HoD — Warning Zone Duration Exceeded',
           reactivated_at         = NULL,
           updated_at             = now()
       where id = $1 and status = 'active' and deleted_at is null`,
      [parsed.data.student_id]
    );

    await client.query(
      `insert into student_status_history
         (student_id, previous_status, new_status, reason, triggered_by)
       values ($1, 'active', 'struck_off',
           $2, 'HOD')`,
       [
         parsed.data.student_id,
         `Struck off by HoD — remained in the ${student.leave_type} leave policy warning zone (below ${student.warning_below}%) for 10+ consecutive working days`,
       ]
    );

    // Notification sent directly to the student's account
    await client.query(
      `insert into notifications
         (recipient_type, recipient_id, title, message)
       values ('student', $1,
         'Enrollment Struck-Off Notice',
         '<p><strong>This is an official notice from City College.</strong></p>
<p>Your enrollment has been <strong>struck off</strong> from the class register by the Head of Department because your attendance has remained in the warning zone (below ${student.warning_below}%) for an extended consecutive period.</p>
<ul>
  <li>You are <strong>not eligible</strong> to appear in mid/final examinations.</li>
  <li>Your Roll Number Slip will <strong>not be issued</strong> until your enrollment status is reinstated.</li>
  <li>Please contact the Administration or your Class Coordinator immediately to apply for reinstatement.</li>
</ul>')`,
      [parsed.data.student_id]
    );

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true, name: student.name });
}
