import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const classId = request.nextUrl.searchParams.get("class_id");
  const date = request.nextUrl.searchParams.get("date");
  if (!classId || !date) {
    return NextResponse.json({ error: "class_id and date are required." }, { status: 400 });
  }

  const semester = await queryOne<Record<string, unknown>>(
    `select s.*, c.class_name, c.session, d.name as department_name
     from semesters s
     join classes c on c.id = s.class_id
     join departments d on d.id = s.department_id
     where s.class_id = $1 and s.status = 'active'`,
    [classId]
  );
  if (!semester) {
    return NextResponse.json({ error: "This class has no active semester." }, { status: 404 });
  }

  const students = await query<Record<string, unknown>>(
    `select st.id as student_id, st.name, st.roll_no, st.contact,
            r.status, r.reason, r.call_remarks,
            (r.status is not null) as already_marked
     from students st
     left join student_attendance_records r
       on r.student_id = st.id and r.attendance_date = $1
     where st.class_id = $2 and st.deleted_at is null and st.status = 'active'
     order by (st.roll_no is null), st.roll_no, st.name`,
    [date, classId]
  );

  const rows = students.map((st) => ({
    student_id: st.student_id,
    name: st.name,
    roll_no: st.roll_no,
    contact: st.contact,
    status: st.status ?? "present",
    reason: st.reason ?? "",
    call_remarks: st.call_remarks ?? "",
    already_marked: (st.already_marked as boolean) ?? false,
  }));

  return NextResponse.json({ semester, rows });
}

const rowSchema = z.object({
  student_id: z.string().uuid(),
  status: z.enum(["present", "absent", "leave"]).default("present"),
  reason: z.string().optional().nullable(),
  call_remarks: z.string().optional().nullable(),
});

const schema = z.object({
  semester_id: z.string().uuid(),
  attendance_date: z.string().min(1),
  rows: z.array(rowSchema).min(1),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const semester = await queryOne<Record<string, unknown>>(`select * from semesters where id = $1`, [d.semester_id]);
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });
  if (semester.status !== "active") {
    return NextResponse.json({ error: "Attendance can only be marked for an active semester." }, { status: 400 });
  }

  const userId = session?.userId ?? null;

  const isCoordinator = session?.role === "coordinator";

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of d.rows) {
      if (isCoordinator) {
        // Coordinators can only mark attendance for the first time — cannot overwrite existing records
        await client.query(
          `insert into student_attendance_records (student_id, semester_id, attendance_date, status, reason, call_remarks, marked_by)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (student_id, attendance_date) do nothing`,
          [row.student_id, d.semester_id, d.attendance_date, row.status, row.reason || null, row.call_remarks || null, userId]
        );
      } else {
        // Admins can update existing records
        await client.query(
          `insert into student_attendance_records (student_id, semester_id, attendance_date, status, reason, call_remarks, marked_by)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (student_id, attendance_date)
           do update set semester_id = excluded.semester_id, status = excluded.status, reason = excluded.reason,
                          call_remarks = excluded.call_remarks, marked_by = excluded.marked_by, updated_at = now()`,
          [row.student_id, d.semester_id, d.attendance_date, row.status, row.reason || null, row.call_remarks || null, userId]
        );
      }
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  // Auto-strike students whose overall semester attendance drops below 50%
  // Only triggers when at least 5 attendance days have been recorded (present+absent).
  // Only affects currently 'active' students; leaves already-struck-off alone.
  const studentIds = d.rows.map((r) => r.student_id);
  await query(
    `update students s
     set status = 'struck_off',
         status_changed_by_name = 'By System due to Attendance Below 50%',
         updated_at = now()
     where s.id = any($1::uuid[])
       and s.deleted_at is null
       and s.status = 'active'
       and exists (
         select 1 from (
           select
             count(*) filter (where sar.status in ('present','absent')) as total_days,
             count(*) filter (where sar.status = 'present')::float /
               nullif(count(*) filter (where sar.status in ('present','absent')), 0) as pct
           from student_attendance_records sar
           where sar.student_id = s.id and sar.semester_id = $2
         ) stats
         where stats.total_days >= 5 and stats.pct < 0.5
       )`,
    [studentIds, d.semester_id]
  );

  return NextResponse.json({ success: true });
}
