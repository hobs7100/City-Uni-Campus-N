import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator", "hod");
  if (response) return response;

  const semesterId = request.nextUrl.searchParams.get("semester_id");
  const classId = request.nextUrl.searchParams.get("class_id");
  const departmentId = request.nextUrl.searchParams.get("department_id");

  const conditions: string[] = [
    "st.deleted_at is null",
    "st.status = 'active'",
  ];
  const values: unknown[] = [];
  let i = 1;

  if (semesterId) {
    conditions.push(`sem.id = $${i++}`);
    values.push(semesterId);
  }
  if (classId) {
    conditions.push(`st.class_id = $${i++}`);
    values.push(classId);
  }
  if (departmentId) {
    conditions.push(`cl.department_id = $${i++}`);
    values.push(departmentId);
  }

  const rows = await query<{
    student_id: string;
    name: string;
    roll_no: string | null;
    contact: string | null;
    class_name: string;
    session: string;
    student_status: string;
    presents: string;
    absents: string;
    leaves: string;
  }>(
    `select st.id as student_id, st.name, st.roll_no, st.contact,
            cl.class_name, cl.session, st.status as student_status,
            count(*) filter (where sar.status = 'present') as presents,
            count(*) filter (where sar.status = 'absent')  as absents,
            count(*) filter (where sar.status = 'leave')   as leaves
     from students st
     join classes cl on cl.id = st.class_id
     join semesters sem on sem.class_id = st.class_id and sem.status = 'active'
     left join student_attendance_records sar
       on sar.student_id = st.id and sar.semester_id = sem.id
     where ${conditions.join(" and ")}
     group by st.id, st.name, st.roll_no, st.contact, cl.class_name, cl.session, st.status
     having
       count(*) filter (where sar.status in ('present','absent')) > 0
       and (count(*) filter (where sar.status = 'present'))::float /
           nullif(count(*) filter (where sar.status in ('present','absent')), 0) < 0.5
     order by cl.class_name, (st.roll_no is null), st.roll_no, st.name`,
    values
  );

  const students = rows.map((r) => {
    const p = Number(r.presents);
    const a = Number(r.absents);
    const l = Number(r.leaves);
    const total = p + a;
    const pct = total > 0 ? Math.round((p / total) * 100) : null;
    return {
      student_id: r.student_id,
      name: r.name,
      roll_no: r.roll_no,
      contact: r.contact,
      class_name: r.class_name,
      session: r.session,
      student_status: r.student_status,
      presents: p,
      absents: a,
      leaves: l,
      percentage: pct,
    };
  });

  return NextResponse.json({ students });
}

const strikeSchema = z.object({
  student_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "hod");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = strikeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 }
    );
  }

  await query(
    `update students
     set status = 'struck_off',
         status_changed_by_name = 'Short Attendance — Below 50%',
         updated_at = now()
     where id = any($1::uuid[])
       and deleted_at is null
       and status = 'active'`,
    [parsed.data.student_ids]
  );

  return NextResponse.json({ success: true });
}
