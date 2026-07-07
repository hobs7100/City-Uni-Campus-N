import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;

  const allocationId = request.nextUrl.searchParams.get("allocation_id");
  const date = request.nextUrl.searchParams.get("date");
  if (!allocationId || !date) {
    return NextResponse.json({ error: "allocation_id and date are required." }, { status: 400 });
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

  const semRows = await query<{ class_id: string; status: string }>(
    `select s.class_id, s.status
     from allocation_semesters als
     join semesters s on s.id = als.semester_id
     where als.allocation_id = $1`,
    [allocationId]
  );

  const activeSems = semRows.filter((r) => r.status === "active");
  if (activeSems.length === 0) {
    return NextResponse.json({ error: "No active semester found for this allocation." }, { status: 404 });
  }

  const classIds = activeSems.map((r) => r.class_id);

  const students = await query<{
    student_id: string;
    name: string;
    roll_no: string | null;
    contact: string | null;
    class_name: string;
    session: string;
    status: string | null;
    reason: string | null;
    call_remarks: string | null;
  }>(
    `select st.id as student_id, st.name, st.roll_no, st.contact,
            cl.class_name, cl.session,
            sca.status, sca.reason, sca.call_remarks
     from students st
     join classes cl on cl.id = st.class_id
     left join student_course_attendance sca
       on sca.student_id = st.id
      and sca.allocation_id = $1
      and sca.attendance_date = $2
     where st.class_id = any($3::uuid[])
       and st.deleted_at is null
       and st.status = 'active'
     order by cl.class_name, (st.roll_no is null), st.roll_no, st.name`,
    [allocationId, date, classIds]
  );

  const rows = students.map((st) => ({
    student_id: st.student_id,
    name: st.name,
    roll_no: st.roll_no,
    contact: st.contact,
    class_name: st.class_name,
    session: st.session,
    status: (st.status as "present" | "absent" | "leave") ?? "present",
    reason: st.reason ?? "",
    call_remarks: st.call_remarks ?? "",
  }));

  return NextResponse.json({ is_combined: allocation.is_combined, rows });
}

const rowSchema = z.object({
  student_id: z.string().uuid(),
  status: z.enum(["present", "absent", "leave"]).default("present"),
  reason: z.string().optional().nullable(),
  call_remarks: z.string().optional().nullable(),
});

const schema = z.object({
  allocation_id: z.string().uuid(),
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

  const allocation = await queryOne<{ id: string }>(
    `select a.id from allocations a where a.id = $1 and a.teacher_id = $2`,
    [d.allocation_id, session!.userId]
  );
  if (!allocation) {
    return NextResponse.json({ error: "Allocation not found or not yours." }, { status: 403 });
  }

  const activeSem = await queryOne<{ id: string }>(
    `select s.id from semesters s
     join allocation_semesters als on als.semester_id = s.id
     where als.allocation_id = $1 and s.status = 'active'
     limit 1`,
    [d.allocation_id]
  );
  if (!activeSem) {
    return NextResponse.json({ error: "No active semester for this allocation." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of d.rows) {
      await client.query(
        `insert into student_course_attendance
           (allocation_id, student_id, attendance_date, status, reason, call_remarks, marked_by)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (allocation_id, student_id, attendance_date)
         do update set status        = excluded.status,
                       reason        = excluded.reason,
                       call_remarks  = excluded.call_remarks,
                       marked_by     = excluded.marked_by,
                       updated_at    = now()`,
        [
          d.allocation_id,
          row.student_id,
          d.attendance_date,
          row.status,
          row.reason || null,
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
