import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { PoolClient } from "pg";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

function dayNameFor(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

interface AttendanceLeg {
  class_id: string;
  class_name: string;
  session: string;
  status: string;
  has_catalog: boolean;
  syllabus_completed_at: string | null;
}

// Both roster reads and saves must use the same class/slot eligibility rules.
// A combined lecture needs only one scheduled anchor cell, but every unfinished
// class linked to that allocation belongs in its roster.
async function resolveAttendanceClasses(
  allocationId: string,
  isCombined: boolean,
  date: string,
  startTime: string,
  endTime: string,
  client?: PoolClient
) {
  const sql = `select distinct s.class_id, cl.class_name, cl.session, s.status,
            sc.semester_id is not null as has_catalog, sc.syllabus_completed_at
     from allocation_semesters als
     join allocations a on a.id = als.allocation_id
     join semesters s on s.id = als.semester_id
     join classes cl on cl.id = s.class_id
     left join semester_courses sc
       on sc.semester_id = s.id and sc.course_id = a.course_id
     where als.allocation_id = $1
       and als.course_id = a.course_id
       and exists (
         select 1
         from timetable_cells tc
         join timetables tt on tt.id = tc.timetable_id
         join timetable_days td on td.id = tc.day_id
         join timetable_periods tp on tp.id = tc.period_id
         join allocation_semesters slot_als
           on slot_als.allocation_id = tc.allocation_id
          and slot_als.semester_id = tt.semester_id
          and slot_als.course_id = a.course_id
         join semesters slot_semester
           on slot_semester.id = slot_als.semester_id and slot_semester.status = 'active'
         join semester_courses slot_sc
           on slot_sc.semester_id = slot_als.semester_id
          and slot_sc.course_id = a.course_id
           and ($5::boolean or slot_sc.syllabus_completed_at is null)
         where tc.allocation_id = als.allocation_id
           and ($5::boolean or tt.semester_id = als.semester_id)
           and td.day_name = $2
           and tp.start_time = $3
           and tp.end_time = $4
       )`;
  const params = [allocationId, dayNameFor(date), startTime, endTime, isCombined];
  const legs = client
    ? (await client.query<AttendanceLeg>(sql, params)).rows
    : await query<AttendanceLeg>(sql, params);
  const missingCombinedClass = isCombined && legs.length > 0 &&
    new Set(legs.map((leg) => leg.class_id)).size < 2;
  const eligible = legs.filter((leg) =>
    leg.status === "active" && leg.has_catalog && leg.syllabus_completed_at === null
  );
  const classIds = [...new Set(eligible.map((leg) => leg.class_id))];
  const excludedClasses = legs
    .filter((leg) => !classIds.includes(leg.class_id))
    .map((leg) => ({
      class_name: leg.class_name,
      session: leg.session,
      reason: leg.status !== "active"
        ? "semester is closed"
        : !leg.has_catalog
          ? "course is missing from the class curriculum"
          : "syllabus is marked complete",
    }));
  return { classIds, excludedClasses, missingCombinedClass };
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

  const allocation = await queryOne<{ id: string; is_combined: boolean; status: string }>(
    `select a.id, a.is_combined, a.status
     from allocations a
     where a.id = $1 and a.teacher_id = $2`,
    [allocationId, session!.userId]
  );
  if (!allocation) {
    return NextResponse.json({ error: "Allocation not found or not yours." }, { status: 403 });
  }
  if (allocation.status !== "active") {
    return NextResponse.json({ error: "This course has been transferred to another teacher." }, { status: 403 });
  }
  const { classIds, excludedClasses, missingCombinedClass } = await resolveAttendanceClasses(
    allocationId, allocation.is_combined, date, startTime, endTime
  );
  if (missingCombinedClass) {
    return NextResponse.json(
      { error: "This combined course is missing a linked class. Ask an administrator to correct its allocation." },
      { status: 409 }
    );
  }
  if (classIds.length === 0) {
    return NextResponse.json(
      { error: "No active, unfinished class has this scheduled lecture. Attendance cannot be marked." },
      { status: 403 }
    );
  }

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
       and sca.start_time = $4 and sca.end_time = $5
     left join student_attendance_records sar
       on sar.student_id      = st.id
      and sar.attendance_date = $2
      and sar.status in ('absent', 'leave')
     where st.class_id = any($3::uuid[])
       and st.deleted_at is null
       and st.status in ('active', 'struck_off', 'permanent_leave')
     order by cl.class_name, (st.roll_no is null), st.roll_no, st.name`,
    [allocationId, date, classIds, startTime, endTime]
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

  return NextResponse.json({ is_combined: allocation.is_combined, excluded_classes: excludedClasses, rows });
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

  const client = await pool.connect();
  try {
    await client.query("begin");
    const allocationResult = await client.query<{ id: string; status: string; is_combined: boolean }>(
      `select id, status, is_combined from allocations
       where id = $1 and teacher_id = $2 for update`,
      [d.allocation_id, session!.userId]
    );
    const allocation = allocationResult.rows[0];
    if (!allocation || allocation.status !== "active") {
      await client.query("rollback");
      return NextResponse.json(
        { error: "This active course is no longer allocated to your account." },
        { status: 403 }
      );
    }

    // Hold the class links, curriculum and scheduled slot stable through save.
    await client.query(
      `select als.id from allocation_semesters als
       join semesters s on s.id = als.semester_id
       join semester_courses sc on sc.semester_id = s.id and sc.course_id = als.course_id
       where als.allocation_id = $1
       for share of als, s, sc`,
      [d.allocation_id]
    );
    await client.query(
      `select tc.id from timetable_cells tc
       join timetables tt on tt.id = tc.timetable_id
       join timetable_days td on td.id = tc.day_id
       join timetable_periods tp on tp.id = tc.period_id
       where tc.allocation_id = $1 and td.day_name = $2
         and tp.start_time = $3 and tp.end_time = $4
       for share of tc, tt, td, tp`,
      [d.allocation_id, dayNameFor(d.attendance_date), d.start_time, d.end_time]
    );
    const { classIds, missingCombinedClass } = await resolveAttendanceClasses(
      d.allocation_id, allocation.is_combined, d.attendance_date, d.start_time, d.end_time, client
    );
    if (missingCombinedClass) {
      await client.query("rollback");
      return NextResponse.json(
        { error: "This combined course is missing a linked class. Ask an administrator to correct its allocation." },
        { status: 409 }
      );
    }
    if (!classIds.length) {
      await client.query("rollback");
      return NextResponse.json(
        { error: "No active, unfinished class has this scheduled lecture. Attendance cannot be marked." },
        { status: 403 }
      );
    }
    // Lock the entire eligible roster, not just submitted rows. A stale or
    // partial one-class request must never be reported as a successful save
    // for a combined lecture.
    await client.query(
      `select st.id from students st
       where st.class_id = any($1::uuid[])
         and st.deleted_at is null
         and st.status in ('active', 'struck_off', 'permanent_leave')
       order by st.id for update of st`,
      [classIds]
    );
    // Leave issuance and coordinator attendance lock these student rows too.
    // Read their status in a new statement after any competing write commits.
    const roster = await client.query<{
      id: string;
      status: string;
      monthly_on_leave: boolean;
      coord_locked: boolean;
    }>(
      `select st.id, st.status,
              exists (
                select 1 from student_leaves sl
                where sl.student_id = st.id and sl.revoked_at is null
                  and sl.leave_type = 'monthly'
                  and $2::date between sl.leave_start_date and sl.leave_end_date
              ) as monthly_on_leave,
              exists (
                select 1 from student_attendance_records sar
                where sar.student_id = st.id and sar.attendance_date = $2
                  and sar.status = 'leave'
              ) as coord_locked
       from students st
       where st.class_id = any($1::uuid[])
         and st.deleted_at is null
         and st.status in ('active', 'struck_off', 'permanent_leave')
       order by st.id`,
      [classIds, d.attendance_date]
    );
    const markableIds = roster.rows
      .filter((student) =>
        student.status === "active" && !student.monthly_on_leave && !student.coord_locked
      )
      .map((student) => student.id);
    const submittedIds = new Set(d.rows.map((row) => row.student_id));
    if (
      submittedIds.size !== d.rows.length ||
      submittedIds.size !== markableIds.length ||
      markableIds.some((id) => !submittedIds.has(id))
    ) {
      await client.query("rollback");
      return NextResponse.json(
        { error: "The roster has changed or is incomplete. Reload it and mark students from every included class." },
        { status: 409 }
      );
    }
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

  return NextResponse.json({ success: true });
}
