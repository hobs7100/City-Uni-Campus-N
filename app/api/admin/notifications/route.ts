import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne, getClient } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

/* ─── GET — list broadcasts with optional filters ─────────────────────────── */
export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const { searchParams } = request.nextUrl;
  const deptId    = searchParams.get("department_id");
  const classId   = searchParams.get("class_id");
  const session   = searchParams.get("session");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (deptId)   { conditions.push(`nb.department_id = $${i++}`); values.push(deptId); }
  if (classId)  { conditions.push(`nb.class_id = $${i++}`);      values.push(classId); }
  if (session)  { conditions.push(`nb.session = $${i++}`);       values.push(session); }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const broadcasts = await query(
    `select nb.*,
            d.name  as department_name,
            c.class_name,
            u.name  as created_by_name
     from notification_broadcasts nb
     left join departments d on d.id = nb.department_id
     left join classes     c on c.id = nb.class_id
     left join users       u on u.id = nb.created_by
     ${where}
     order by nb.created_at desc
     limit 200`,
    values
  );

  return NextResponse.json({ broadcasts });
}

/* ─── POST — create broadcast and fan-out ─────────────────────────────────── */
const postSchema = z.object({
  department_id:     z.string().uuid(),
  class_id:          z.string().uuid().nullable().optional(),
  session:           z.string().min(1).nullable().optional(),
  notification_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subject:           z.string().min(1).max(200),
  body:              z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { session: sess, response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }

  const d = parsed.data;

  /* verify department exists */
  const dept = await queryOne(`select id, hod_id from departments where id = $1`, [d.department_id]);
  if (!dept) return NextResponse.json({ error: "Department not found." }, { status: 404 });

  /* ── collect recipient ids ── */
  // Students
  const studentConds: string[] = ["s.status = 'active'", "s.deleted_at is null", "s.department_id = $1"];
  const studentVals: unknown[] = [d.department_id];
  let si = 2;
  if (d.class_id) { studentConds.push(`s.class_id = $${si++}`); studentVals.push(d.class_id); }
  else if (d.session) { studentConds.push(`c.session = $${si++}`); studentVals.push(d.session); }

  const studentRows = await query<{ id: string }>(
    `select s.id from students s
     join classes c on c.id = s.class_id
     where ${studentConds.join(" and ")}`,
    studentVals
  );

  // Teachers
  let teacherRows: { id: string }[];
  if (d.class_id) {
    teacherRows = await query<{ id: string }>(
      `select distinct a.teacher_id as id
       from allocations a
       join allocation_semesters als on als.allocation_id = a.id
       join semesters sm on sm.id = als.semester_id
       where sm.class_id = $1`,
      [d.class_id]
    );
  } else {
    teacherRows = await query<{ id: string }>(
      `select id from teachers where department_id = $1 and status = 'active' and deleted_at is null`,
      [d.department_id]
    );
  }

  // HOD (if department has one)
  const hodId = (dept as { hod_id: string | null }).hod_id;

  /* ── build notification insert rows ── */
  type NRow = ["student" | "teacher" | "user", string];
  const notifRows: NRow[] = [
    ...studentRows.map((r): NRow => ["student", r.id]),
    ...teacherRows.map((r): NRow => ["teacher", r.id]),
    ...(hodId ? [["user", hodId] as NRow] : []),
  ];

  const recipientCount = notifRows.length;

  /* ── transactionally insert broadcast + notifications ── */
  const client = await getClient();
  try {
    await client.query("begin");

    const bcRes = await client.query(
      `insert into notification_broadcasts
         (department_id, class_id, session, notification_date, subject, body, recipient_count, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id`,
      [
        d.department_id,
        d.class_id ?? null,
        d.session ?? null,
        d.notification_date,
        d.subject,
        d.body,
        recipientCount,
        sess!.userId,
      ]
    );
    const broadcastId = bcRes.rows[0].id as string;
    void broadcastId; // stored for audit; not used further in this request

    if (notifRows.length > 0) {
      const valuePlaceholders = notifRows
        .map((_, idx) => `(${idx * 4 + 1}, ${idx * 4 + 2}, ${idx * 4 + 3}, ${idx * 4 + 4})`)
        .join(", ");
      const flatVals = notifRows.flatMap(([type, id]) => [type, id, d.subject, d.body]);

      await client.query(
        `insert into notifications (recipient_type, recipient_id, title, message)
         values ${valuePlaceholders}`,
        flatVals
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    console.error("notification broadcast error", err);
    return NextResponse.json({ error: "Failed to post notification." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true, recipient_count: recipientCount });
}
