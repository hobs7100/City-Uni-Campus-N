import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { runAutoStruckOff } from "@/lib/auto-struck-off";

function dayNameFor(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const allocationId = request.nextUrl.searchParams.get("allocation_id");
  const date         = request.nextUrl.searchParams.get("date");
  const startTime    = request.nextUrl.searchParams.get("start_time") || null;
  const endTime      = request.nextUrl.searchParams.get("end_time")   || null;

  if (!allocationId || !date) {
    return NextResponse.json({ error: "allocation_id and date are required." }, { status: 400 });
  }
  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: "Select a scheduled timetable slot before loading attendance." },
      { status: 400 }
    );
  }

  const allocation = await queryOne<{ id: string; is_combined: boolean }>(
    `select a.id, a.is_combined
     from allocations a
     where a.id = $1 and a.teacher_id = $2`,
    [allocationId, session!.userId]
  );
  if (!allocation) {
    return NextResponse.json({ error: "Allocation not found or not yours." }, { status: 403 });
  }

  const hasRequestedSlot = Boolean(startTime && endTime);
  const semRows = await query<{ class_id: string; status: string; syllabus_completed_at: string | null }>(
    `select distinct s.class_id, s.status, sc.syllabus_completed_at
     from allocation_semesters als
     join semesters s on s.id = als.semester_id
     join allocations a on a.id = als.allocation_id
     left join semester_courses sc
       on sc.semester_id = s.id and sc.course_id = a.course_id
      where als.allocation_id = $1
        ${hasRequestedSlot ? `
        and exists (
          select 1
          from timetable_cells tc
          join timetables tt on tt.id = tc.timetable_id
          join timetable_days td on td.id = tc.day_id
          join timetable_periods tp on tp.id = tc.period_id
          join allocation_semesters slot_als
            on slot_als.allocation_id = tc.allocation_id
           and slot_als.semester_id = tt.semester_id
          join semesters slot_semester
            on slot_semester.id = slot_als.semester_id
           and slot_semester.status = 'active'
          join semester_courses slot_sc
            on slot_sc.semester_id = slot_als.semester_id
           and slot_sc.course_id = slot_als.course_id
           and slot_sc.syllabus_completed_at is null
          where tc.allocation_id = als.allocation_id
            and (a.is_combined or tt.semester_id = als.semester_id)
            and td.day_name = $2
            and tp.start_time = $3
            and tp.end_time = $4
        )` : ""}`,
    hasRequestedSlot
      ? [allocationId, dayNameFor(date), startTime, endTime]
      : [allocationId]
  );

  // A combined allocation may have one completed class-semester-course leg
  // and another still in progress. Only the unfinished legs remain markable.
  const activeSems = semRows.filter(
    (r) => r.status === "active" && r.syllabus_completed_at === null
  );
  if (activeSems.length === 0) {
    return NextResponse.json(
      { error: "Syllabus is complete for this course. Attendance can no longer be marked." },
      { status: 403 }
    );
  }

  const classIds = activeSems.map((r) => r.class_id);

  // Build slot-aware join condition for student_course_attendance:
  // - If start_time provided: match exact slot
  // - If not: match rows that have no slot (null), i.e. old-style records
  const slotFilter =
    startTime && endTime
      ? `and sca.start_time = $4 and sca.end_time = $5`
      : `and sca.start_time is null`;

  const params: unknown[] =
    startTime && endTime
      ? [allocationId, date, classIds, startTime, endTime]
      : [allocationId, date, classIds];

  const students = await query<{
    student_id: string;
    name: string;
    father_name: string | null;
    roll_no: string | null;
    contact: string | null;
    class_name: string;
    session: string;
    student_status: string;
    monthly_on_leave: boolean;
    att_status: string | null;
    reason: string | null;
    call_remarks: string | null;
    coord_status: string | null;
  }>(
    `select st.id as student_id, st.name, st.father_name, st.roll_no, st.contact,
            cl.class_name, cl.session, st.status as student_status,
             exists (
               select 1 from student_leaves sl
               where sl.student_id = st.id and sl.revoked_at is null
                 and sl.leave_type = 'monthly'
                 and $2::date between sl.leave_start_date and sl.leave_end_date
             ) as monthly_on_leave,
            sca.status as att_status, sca.reason, sca.call_remarks,
            sar.status  as coord_status
     from students st
     join classes cl on cl.id = st.class_id
     left join student_course_attendance sca
       on sca.student_id    = st.id
      and sca.allocation_id = $1
      and sca.attendance_date = $2
      ${slotFilter}
     left join student_attendance_records sar
       on sar.student_id      = st.id
      and sar.attendance_date = $2
      and sar.status in ('absent', 'leave')
     where st.class_id = any($3::uuid[])
       and st.deleted_at is null
       and st.status in ('active', 'struck_off', 'permanent_leave')
     order by cl.class_name, (st.roll_no is null), st.roll_no, st.name`,
    params
  );

  const rows = students.map((st) => {
    const isStruckOff = st.student_status === "struck_off";
    const isOnLeave   = st.student_status === "permanent_leave" || st.monthly_on_leave === true;
    // Only "leave" set by coordinator locks the teacher's subject attendance.
    // "absent" set by coordinator is informational — teacher can still mark course attendance.
    const coordLocked = st.coord_status === "leave";
    return {
      student_id:     st.student_id,
      name:           st.name,
      father_name:    st.father_name ?? null,
      roll_no:        st.roll_no,
      contact:        st.contact,
      class_name:     st.class_name,
      session:        st.session,
      student_status: st.student_status,
      locked:         isStruckOff || isOnLeave || coordLocked,
      coord_locked:   coordLocked,
      coord_status:   (st.coord_status ?? null) as "absent" | "leave" | null,
      status: (
        isOnLeave   ? "leave"  :
        isStruckOff ? "absent" :
        coordLocked ? "leave"  :
        (st.att_status ?? "present")
      ) as "present" | "absent" | "leave",
      reason:       st.reason ?? "",
      call_remarks: st.call_remarks ?? "",
    };
  });

  return NextResponse.json({ is_combined: allocation.is_combined, rows });
}

const rowSchema = z.object({
  student_id:   z.string().uuid(),
  status:       z.enum(["present", "absent", "leave"]).default("present"),
  reason:       z.string().optional().nullable(),
  call_remarks: z.string().optional().nullable(),
});

const schema = z.object({
  allocation_id:   z.string().uuid(),
  attendance_date: z.string().min(1),
  start_time:      z.string().min(1),
  end_time:        z.string().min(1),
  rows:            z.array(rowSchema).min(1),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const allocation = await queryOne<{ id: string; status: string }>(
    `select a.id, a.status from allocations a where a.id = $1 and a.teacher_id = $2`,
    [d.allocation_id, session!.userId]
  );
  if (!allocation) {
    return NextResponse.json({ error: "Allocation not found or not yours." }, { status: 403 });
  }
  if (allocation.status !== "active") {
    return NextResponse.json(
      { error: "This course has been transferred to another teacher. You can no longer mark attendance for it." },
      { status: 403 }
    );
  }

  // Fetch all active semesters (and their class_ids) for this allocation.
  // Combined allocations span multiple classes/semesters.
  const activeSemsWithClass = await query<{ id: string; class_id: string }>(
    `select distinct s.id, s.class_id from semesters s
     join allocation_semesters als on als.semester_id = s.id
     join allocations a on a.id = als.allocation_id
     left join semester_courses sc
       on sc.semester_id = s.id and sc.course_id = a.course_id
     where als.allocation_id = $1
       and s.status = 'active'
        and sc.syllabus_completed_at is null
        and exists (
          select 1
          from timetable_cells tc
          join timetables tt on tt.id = tc.timetable_id
          join timetable_days td on td.id = tc.day_id
          join timetable_periods tp on tp.id = tc.period_id
          join allocation_semesters slot_als
            on slot_als.allocation_id = tc.allocation_id
           and slot_als.semester_id = tt.semester_id
          join semesters slot_semester
            on slot_semester.id = slot_als.semester_id
           and slot_semester.status = 'active'
          join semester_courses slot_sc
            on slot_sc.semester_id = slot_als.semester_id
           and slot_sc.course_id = slot_als.course_id
           and slot_sc.syllabus_completed_at is null
          where tc.allocation_id = als.allocation_id
            and (a.is_combined or tt.semester_id = als.semester_id)
            and td.day_name = $2
            and tp.start_time = $3
            and tp.end_time = $4
        )`,
    [d.allocation_id, dayNameFor(d.attendance_date), d.start_time, d.end_time]
  );
  if (!activeSemsWithClass.length) {
    return NextResponse.json(
      { error: "Syllabus is complete for this course. Attendance can no longer be marked." },
      { status: 403 }
    );
  }
  const classIds    = activeSemsWithClass.map((r) => r.class_id);

  // Do not permit a caller to submit rows from a completed (or unrelated)
  // class leg of a combined allocation.
  const eligibleStudents = await query<{ id: string }>(
    `select id from students
     where id = any($1::uuid[]) and class_id = any($2::uuid[]) and deleted_at is null`,
    [d.rows.map((row) => row.student_id), classIds]
  );
  if (eligibleStudents.length !== new Set(d.rows.map((row) => row.student_id)).size) {
    return NextResponse.json(
      { error: "One or more students do not belong to an active, incomplete course class." },
      { status: 403 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    // Serialize with leave issuance so the leave range and attendance status
    // are evaluated from one consistent state.
    await client.query(
      `select id from students
       where id = any($1::uuid[])
       order by id
       for update`,
      [d.rows.map((row) => row.student_id)]
    );
    for (const row of d.rows) {
      await client.query(
        `insert into student_course_attendance
           (allocation_id, student_id, attendance_date, start_time, end_time,
            status, reason, call_remarks, marked_by)
          values ($1,$2,$3,$4,$5,
            case when exists (
              select 1 from student_leaves sl
              where sl.student_id = $2 and sl.revoked_at is null
                and sl.leave_type = 'monthly'
                and $3::date between sl.leave_start_date and sl.leave_end_date
            ) then 'leave'::student_attendance_status else $6::student_attendance_status end,
            $7,$8,$9)
         on conflict (allocation_id, student_id, attendance_date, start_time, end_time)
         where start_time is not null
         do update set status        = excluded.status,
                       reason        = excluded.reason,
                       call_remarks  = excluded.call_remarks,
                       marked_by     = excluded.marked_by,
                       updated_at    = now()`,
        [
          d.allocation_id,
          row.student_id,
          d.attendance_date,
          d.start_time,
          d.end_time,
          row.status,
          row.reason       || null,
          row.call_remarks || null,
          session!.userId,
        ]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  // ── Auto struck-off evaluation (teacher path) ────────────────────────────
  // Runs in a separate transaction AFTER the attendance is committed so that
  // a struck-off evaluation failure never causes attendance data to be lost.
  //
  // Combined allocations span multiple active semesters (each a different
  // class).  We must evaluate each semester independently: attendance records
  // in student_attendance_records are scoped to a specific semester_id, so
  // passing all classIds under a single semesterId would leave every student
  // in the non-primary semesters with zero matching records and skip them.
  try {
    for (const sem of activeSemsWithClass) {
      const studentsInSem = await query<{ id: string }>(
        `select id from students
         where class_id  = $1
           and deleted_at is null
           and status    = 'active'`,
        [sem.class_id]
      );
      if (!studentsInSem.length) continue;

      const evalClient = await pool.connect();
      try {
        await evalClient.query("begin");
        await runAutoStruckOff({
          studentIds: studentsInSem.map((s) => s.id),
          semesterId: sem.id,
          classIds:   [sem.class_id],
          triggeredBy: "TEACHER",
          client: evalClient,
        });
        await evalClient.query("commit");
      } catch {
        await evalClient.query("rollback");
        // Non-fatal: attendance is already saved
      } finally {
        evalClient.release();
      }
    }
  } catch {
    // Never let evaluation failure surface as an API error
  }

  return NextResponse.json({ success: true });
}
