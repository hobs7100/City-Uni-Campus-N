import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  class_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1).optional(),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }

  const { class_id: classId, student_ids: requestedIds } = parsed.data;
  const client = await pool.connect();

  try {
    await client.query("begin");

    const classResult = await client.query<{ class_name: string; session: string }>(
      `select class_name, session from classes where id = $1`,
      [classId],
    );
    if (!classResult.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const students = await client.query<{ id: string; status: string }>(
      `select id, status
       from students
       where class_id = $1
         and deleted_at is null
         and status = 'struck_off'
         and ($2::uuid[] is null or id = any($2::uuid[]))
       for update`,
      [classId, requestedIds ?? null],
    );

    if (requestedIds && students.rowCount !== requestedIds.length) {
      await client.query("rollback");
      return NextResponse.json(
        { error: "One or more selected students are not struck off in this class." },
        { status: 400 },
      );
    }
    if (!students.rowCount) {
      await client.query("rollback");
      return NextResponse.json(
        { error: "No struck-off students are available to activate in this class." },
        { status: 400 },
      );
    }

    const studentIds = students.rows.map((student) => student.id);
    const updateResult = await client.query<{ id: string; name: string }>(
      `update students
       set status = 'active',
           status_changed_by_name = $2,
           status_change_date = null,
           status_change_semester = null,
           reactivated_at = now(),
           updated_at = now()
       where id = any($1::uuid[])
       returning id, name`,
      [studentIds, session?.name ?? "Admin"],
    );

    for (const student of updateResult.rows) {
      await client.query(
        `insert into student_status_history
           (student_id, previous_status, new_status, reason, triggered_by)
         values ($1, 'struck_off', 'active', $2, 'ADMIN')`,
        [
          student.id,
          `Bulk reactivated by Admin for ${classResult.rows[0].class_name} (${classResult.rows[0].session})`,
        ],
      );
    }

    await client.query("commit");
    return NextResponse.json({
      success: true,
      activated_count: updateResult.rowCount ?? 0,
    });
  } catch (error) {
    await client.query("rollback");
    console.error("Class-wise student activation failed:", error);
    return NextResponse.json(
      { error: "Students could not be activated." },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}