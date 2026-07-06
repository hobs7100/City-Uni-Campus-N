import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
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

  const allocation = await queryOne<{ id: string; is_combined: boolean }>(
    `select a.id, a.is_combined
     from allocations a
     join allocation_semesters als on als.allocation_id = a.id
     where a.teacher_id = $1 and als.semester_id = $2
     limit 1`,
    [session!.userId, (semester as { id: string }).id]
  );
  if (!allocation) {
    return NextResponse.json(
      { error: "You are not allocated to teach any course for this class's active semester." },
      { status: 403 }
    );
  }

  const classIds = await query<{ class_id: string }>(
    `select distinct s2.class_id
     from allocation_semesters als
     join semesters s2 on s2.id = als.semester_id
     where als.allocation_id = $1`,
    [allocation.id]
  );
  const relevantClassIds = classIds.map((r) => r.class_id);

  const students = await query<Record<string, unknown>>(
    `select st.id as student_id, st.name, st.roll_no, st.contact, st.class_id,
            cl.class_name, cl.session,
            r.status, r.reason, r.call_remarks
     from students st
     join classes cl on cl.id = st.class_id
     left join student_attendance_records r
       on r.student_id = st.id and r.attendance_date = $1
     where st.class_id = any($2::uuid[]) and st.deleted_at is null and st.status = 'active'
     order by cl.class_name, (st.roll_no is null), st.roll_no, st.name`,
    [date, relevantClassIds]
  );

  const rows = students.map((st) => ({
    student_id: st.student_id,
    name: st.name,
    roll_no: st.roll_no,
    contact: st.contact,
    class_name: st.class_name,
    session: st.session,
    status: st.status ?? "present",
    reason: st.reason ?? "",
    call_remarks: st.call_remarks ?? "",
  }));

  return NextResponse.json({ semester, is_combined: allocation.is_combined, rows });
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
  const { session, response } = await requireRole("teacher");
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

  const allocation = await queryOne(
    `select 1 from allocations a
     join allocation_semesters als on als.allocation_id = a.id
     where a.teacher_id = $1 and als.semester_id = $2`,
    [session!.userId, d.semester_id]
  );
  if (!allocation) {
    return NextResponse.json({ error: "You are not allocated to teach this class's active semester." }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of d.rows) {
      await client.query(
        `insert into student_attendance_records (student_id, semester_id, attendance_date, status, reason, call_remarks, marked_by)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (student_id, attendance_date)
         do update set semester_id = excluded.semester_id, status = excluded.status, reason = excluded.reason,
                        call_remarks = excluded.call_remarks, marked_by = excluded.marked_by, updated_at = now()`,
        [row.student_id, d.semester_id, d.attendance_date, row.status, row.reason || null, row.call_remarks || null, session!.userId]
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
