import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z
  .object({
    course_id: z.string().uuid(),
    teacher_id: z.string().uuid(),
    semester_id: z.string().uuid(),
    allocation_type: z.enum(["workload", "per_credit_hour", "fixed"]),
    rate: z.coerce.number().nonnegative(),
    is_combined: z.boolean().default(false),
    combined_semester_ids: z.array(z.string().uuid()).default([]),
  })
  .refine((d) => !d.is_combined || d.combined_semester_ids.length > 0, {
    message: "Select at least one combined class for a combined allocation.",
    path: ["combined_semester_ids"],
  });

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator", "teacher");
  if (response) return response;

  const teacherId = request.nextUrl.searchParams.get("teacher_id");
  const semesterId = request.nextUrl.searchParams.get("semester_id");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (teacherId) { conditions.push(`a.teacher_id = $${i++}`); values.push(teacherId); }
  if (semesterId) {
    conditions.push(`exists (select 1 from allocation_semesters ax where ax.allocation_id = a.id and ax.semester_id = $${i++})`);
    values.push(semesterId);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const allocations = await query(
    `select a.*, c.code as course_code, c.title as course_title, c.credit_hours,
            t.name as teacher_name, t.type as teacher_type,
            coalesce(
              (select json_agg(json_build_object(
                  'semester_id', s.id,
                  'class_id', s.class_id,
                  'department_id', cl.department_id,
                  'class_name', cl.class_name,
                  'session', cl.session,
                  'semester_number', s.semester_number,
                  'term_type', s.term_type,
                  'status', s.status
                ) order by cl.class_name)
               from allocation_semesters als
               join semesters s on s.id = als.semester_id
               join classes cl on cl.id = s.class_id
               where als.allocation_id = a.id),
              '[]'
            ) as semesters
     from allocations a
     join courses c on c.id = a.course_id
     join teachers t on t.id = a.teacher_id
     ${where}
     order by a.created_at desc`,
    values
  );
  return NextResponse.json({ allocations });
}

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const allSemesterIds = Array.from(new Set([d.semester_id, ...d.combined_semester_ids]));

  const semesterRows = await query<{ id: string; status: string }>(
    `select id, status from semesters where id = any($1::uuid[])`,
    [allSemesterIds]
  );
  if (semesterRows.length !== allSemesterIds.length) {
    return NextResponse.json({ error: "One or more selected classes/semesters were not found." }, { status: 404 });
  }
  const inactive = semesterRows.find((s) => s.status !== "active");
  if (inactive) {
    return NextResponse.json({ error: "All selected classes must have an active semester." }, { status: 400 });
  }

  const primaryCatalog = await queryOne(
    `select 1 from semester_courses where semester_id = $1 and course_id = $2`,
    [d.semester_id, d.course_id]
  );
  if (!primaryCatalog) {
    return NextResponse.json(
      { error: "The selected course is not part of the curriculum for the selected class/semester." },
      { status: 400 }
    );
  }

  const catalogRows = await query<{ semester_id: string }>(
    `select semester_id from semester_courses where semester_id = any($1::uuid[]) and course_id = $2`,
    [allSemesterIds, d.course_id]
  );
  const coveredSemesterIds = new Set(catalogRows.map((r) => r.semester_id));
  const semesterIdsNeedingCatalogEntry = allSemesterIds.filter((id) => !coveredSemesterIds.has(id));

  const teacher = await queryOne<{ id: string; department_id: string }>(
    `select id, department_id from teachers where id = $1 and deleted_at is null`,
    [d.teacher_id]
  );
  if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });

  const duplicate = await queryOne(
    `select 1 from allocation_semesters where semester_id = any($1::uuid[]) and course_id = $2`,
    [allSemesterIds, d.course_id]
  );
  if (duplicate) {
    return NextResponse.json(
      { error: "This course is already allocated in one of the selected classes/semesters." },
      { status: 409 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const allocationResult = await client.query(
      `insert into allocations (course_id, teacher_id, allocation_type, rate, is_combined)
       values ($1, $2, $3, $4, $5) returning *`,
      [d.course_id, d.teacher_id, d.allocation_type, d.rate, d.is_combined]
    );
    const allocation = allocationResult.rows[0];

    for (const semesterId of semesterIdsNeedingCatalogEntry) {
      await client.query(
        `insert into semester_courses (semester_id, course_id) values ($1, $2) on conflict (semester_id, course_id) do nothing`,
        [semesterId, d.course_id]
      );
    }

    for (const semesterId of allSemesterIds) {
      await client.query(
        `insert into allocation_semesters (allocation_id, semester_id, course_id) values ($1, $2, $3)`,
        [allocation.id, semesterId, d.course_id]
      );
    }

    await client.query("commit");

    const course = await queryOne<{ title: string }>(`select title from courses where id = $1`, [d.course_id]);
    await query(
      `insert into notifications (recipient_type, recipient_id, title, message) values ('teacher', $1, $2, $3)`,
      [d.teacher_id, "New course allocation", `You have been allocated to teach ${course?.title ?? "a course"}.`]
    ).catch((err) => console.error("Failed to create allocation notification:", err));

    return NextResponse.json({ allocation }, { status: 201 });
  } catch (err: unknown) {
    await client.query("rollback");
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json(
        { error: "This course is already allocated in one of the selected classes/semesters." },
        { status: 409 }
      );
    }
    console.error("Failed to create allocation:", err);
    return NextResponse.json({ error: "Failed to create allocation." }, { status: 500 });
  } finally {
    client.release();
  }
}
