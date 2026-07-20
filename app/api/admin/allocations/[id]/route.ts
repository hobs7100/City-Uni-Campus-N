import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const patchSchema = z.object({
  teacher_id: z.string().uuid(),
  allocation_type: z.enum(["workload", "per_credit_hour", "fixed"]),
  rate: z.coerce.number().nonnegative(),
  semester_ids: z.array(z.string().uuid()).min(1, "Select at least one class/semester."),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const allocation = await queryOne<{ id: string; course_id: string }>(
    `select id, course_id from allocations where id = $1`,
    [id]
  );
  if (!allocation) return NextResponse.json({ error: "Allocation not found." }, { status: 404 });

  const semesterIds = Array.from(new Set(d.semester_ids));

  const semesterRows = await query<{ id: string; status: string }>(
    `select id, status from semesters where id = any($1::uuid[])`,
    [semesterIds]
  );
  if (semesterRows.length !== semesterIds.length) {
    return NextResponse.json({ error: "One or more selected classes/semesters were not found." }, { status: 404 });
  }
  const inactive = semesterRows.find((s) => s.status !== "active");
  if (inactive) {
    return NextResponse.json({ error: "All selected classes must have an active semester." }, { status: 400 });
  }

  const teacher = await queryOne<{ id: string }>(
    `select id from teachers where id = $1 and deleted_at is null`,
    [d.teacher_id]
  );
  if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });

  // Only block if an ACTIVE allocation already exists (transferred ones are allowed to coexist)
  const duplicate = await queryOne(
    `select 1
     from allocation_semesters als
     join allocations a on a.id = als.allocation_id
     where als.semester_id = any($1::uuid[])
       and als.course_id   = $2
       and a.status        = 'active'
       and a.id           != $3`,
    [semesterIds, allocation.course_id, id]
  );
  if (duplicate) {
    return NextResponse.json(
      { error: "This course is already allocated in one of the selected classes/semesters." },
      { status: 409 }
    );
  }

  const catalogRows = await query<{ semester_id: string }>(
    `select semester_id from semester_courses where semester_id = any($1::uuid[]) and course_id = $2`,
    [semesterIds, allocation.course_id]
  );
  const coveredSemesterIds = new Set(catalogRows.map((r) => r.semester_id));
  const semesterIdsNeedingCatalogEntry = semesterIds.filter((sid) => !coveredSemesterIds.has(sid));

  const isCombined = semesterIds.length > 1;

  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const semesterId of semesterIdsNeedingCatalogEntry) {
      await client.query(
        `insert into semester_courses (semester_id, course_id) values ($1, $2) on conflict (semester_id, course_id) do nothing`,
        [semesterId, allocation.course_id]
      );
    }

    const updatedResult = await client.query(
      `update allocations set teacher_id = $1, allocation_type = $2, rate = $3, is_combined = $4, updated_at = now()
       where id = $5 returning *`,
      [d.teacher_id, d.allocation_type, d.rate, isCombined, id]
    );

    await client.query(`delete from allocation_semesters where allocation_id = $1`, [id]);
    for (const semesterId of semesterIds) {
      await client.query(
        `insert into allocation_semesters (allocation_id, semester_id, course_id) values ($1, $2, $3)`,
        [id, semesterId, allocation.course_id]
      );
    }

    await client.query("commit");
    return NextResponse.json({ allocation: updatedResult.rows[0] });
  } catch (err: unknown) {
    await client.query("rollback");
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json(
        { error: "This course is already allocated in one of the selected classes/semesters." },
        { status: 409 }
      );
    }
    console.error("Failed to update allocation:", err);
    return NextResponse.json({ error: "Failed to update allocation." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const existing = await queryOne(`select id from allocations where id = $1`, [id]);
  if (!existing) return NextResponse.json({ error: "Allocation not found." }, { status: 404 });

  await query(`delete from allocations where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
