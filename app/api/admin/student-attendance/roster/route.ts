import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { runAutoStruckOff } from "@/lib/auto-struck-off";

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
    `select st.id as student_id, st.name, st.father_name, st.roll_no, st.contact,
            st.status as student_status,
             exists (
               select 1 from student_leaves sl
               where sl.student_id = st.id and sl.revoked_at is null
                 and sl.leave_type = 'monthly'
                 and $1::date between sl.leave_start_date and sl.leave_end_date
             ) as monthly_on_leave,
            r.status as att_status, r.reason, r.call_remarks,
            (r.status is not null) as already_marked
     from students st
     left join student_attendance_records r
       on r.student_id = st.id
      and r.attendance_date = $1
      and r.semester_id = $3
     where st.class_id = $2 and st.deleted_at is null
       and st.status in ('active', 'struck_off', 'permanent_leave')
     order by (st.roll_no is null), st.roll_no, st.name`,
    [date, classId, semester.id]
  );

  const rows = students.map((st) => {
    const isStruckOff = st.student_status === "struck_off";
    const isOnLeave = st.student_status === "permanent_leave" || st.monthly_on_leave === true;
    return {
      student_id: st.student_id,
      name: st.name,
      father_name: (st.father_name as string) ?? null,
      roll_no: st.roll_no,
      contact: st.contact,
      student_status: st.student_status,
      locked: isStruckOff || isOnLeave,
      status: isOnLeave ? "leave" : isStruckOff ? "absent" : ((st.att_status ?? "present") as string),
      reason: (st.reason as string) ?? "",
      call_remarks: (st.call_remarks as string) ?? "",
      already_marked: (st.already_marked as boolean) ?? false,
    };
  });

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

  const classId = (semester as { class_id: string }).class_id;
  const studentIds = Array.from(new Set(d.rows.map((row) => row.student_id)));
  const validStudents = await query<{ id: string }>(
    `select id
     from students
     where id = any($1::uuid[])
       and class_id = $2
       and deleted_at is null
       and status in ('active', 'struck_off', 'permanent_leave')`,
    [studentIds, classId],
  );
  if (validStudents.length !== studentIds.length) {
    return NextResponse.json(
      { error: "One or more students do not belong to the selected class." },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  let savedCount = 0;
  try {
    await client.query("begin");
    // Serialize with leave issuance so a concurrent attendance save cannot
    // miss a Monthly Leave that is being created for the same student.
    await client.query(
      `select id from students where id = any($1::uuid[]) order by id for update`,
      [studentIds]
    );
    for (const row of d.rows) {
      if (isCoordinator) {
        // Preserve an already-marked status in this semester. If the unique
        // student/date row belongs to an old semester, move it to the selected
        // active semester and save the coordinator's current status.
        const result = await client.query(
          `insert into student_attendance_records (student_id, semester_id, attendance_date, status, reason, call_remarks, marked_by)
           values ($1,$2,$3,
             case when exists (
               select 1 from student_leaves sl
               where sl.student_id = $1 and sl.revoked_at is null
                 and sl.leave_type = 'monthly'
                 and $3::date between sl.leave_start_date and sl.leave_end_date
             ) then 'leave'::student_attendance_status else $4::student_attendance_status end,
             $5,$6,$7)
           on conflict (student_id, attendance_date)
           do update set
             semester_id = case
               when student_attendance_records.semester_id <> excluded.semester_id
                 then excluded.semester_id
               else student_attendance_records.semester_id
             end,
             status = case
                when exists (
                  select 1 from student_leaves sl
                  where sl.student_id = excluded.student_id and sl.revoked_at is null
                    and sl.leave_type = 'monthly'
                    and excluded.attendance_date between sl.leave_start_date and sl.leave_end_date
                ) then 'leave'::student_attendance_status
               when student_attendance_records.semester_id <> excluded.semester_id
                 then excluded.status
               else student_attendance_records.status
             end,
             reason = excluded.reason,
             call_remarks = excluded.call_remarks,
             marked_by = case
               when student_attendance_records.semester_id <> excluded.semester_id
                 then excluded.marked_by
               else student_attendance_records.marked_by
             end,
             updated_at = now()
           returning id`,
          [row.student_id, d.semester_id, d.attendance_date, row.status, row.reason || null, row.call_remarks || null, userId]
        );
        savedCount += result.rowCount ?? 0;
      } else {
        // Admins can update existing records
        const result = await client.query(
          `insert into student_attendance_records (student_id, semester_id, attendance_date, status, reason, call_remarks, marked_by)
           values ($1,$2,$3,
             case when exists (
               select 1 from student_leaves sl
               where sl.student_id = $1 and sl.revoked_at is null
                 and sl.leave_type = 'monthly'
                 and $3::date between sl.leave_start_date and sl.leave_end_date
             ) then 'leave'::student_attendance_status else $4::student_attendance_status end,
             $5,$6,$7)
           on conflict (student_id, attendance_date)
           do update set semester_id = excluded.semester_id, status = excluded.status, reason = excluded.reason,
                          call_remarks = excluded.call_remarks, marked_by = excluded.marked_by, updated_at = now()
           returning id`,
          [row.student_id, d.semester_id, d.attendance_date, row.status, row.reason || null, row.call_remarks || null, userId]
        );
        savedCount += result.rowCount ?? 0;
      }
    }
    if (savedCount !== d.rows.length) {
      throw new Error(
        `Attendance save was incomplete: ${savedCount} of ${d.rows.length} rows were returned.`,
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  // Attendance must remain saved even if the follow-up standing evaluation
  // encounters a separate data problem.
  if (isCoordinator) {
    const strikeClient = await pool.connect();
    try {
      await strikeClient.query("begin");
      await runAutoStruckOff({
        studentIds,
        semesterId: d.semester_id,
        classIds: [classId],
        triggeredBy: "COORDINATOR",
        client: strikeClient,
      });
      await strikeClient.query("commit");
    } catch (error) {
      await strikeClient.query("rollback");
      console.error("Attendance saved, but auto-struck-off evaluation failed:", error);
    } finally {
      strikeClient.release();
    }
  }

  return NextResponse.json({ success: true, saved_count: savedCount });
}
