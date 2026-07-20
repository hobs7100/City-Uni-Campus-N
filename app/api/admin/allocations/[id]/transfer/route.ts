import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  new_teacher_id:   z.string().uuid(),
  transfer_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "transfer_date must be YYYY-MM-DD"),
  allocation_type:  z.enum(["workload", "per_credit_hour", "fixed"]).optional(),
  rate:             z.coerce.number().nonnegative().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // ── 1. Load and validate the source allocation ─────────────────────────────
  const oldAlloc = await queryOne<{
    id: string;
    course_id: string;
    teacher_id: string;
    allocation_type: string;
    rate: string;
    is_combined: boolean;
    status: string;
    transfer_group_id: string | null;
    lecture_seq_offset: number;
  }>(
    `select id, course_id, teacher_id, allocation_type, rate, is_combined,
            status, transfer_group_id, lecture_seq_offset
     from allocations where id = $1`,
    [id],
  );
  if (!oldAlloc) return NextResponse.json({ error: "Allocation not found." }, { status: 404 });
  if (oldAlloc.status !== "active") {
    return NextResponse.json(
      { error: "Only active allocations can be transferred." },
      { status: 409 },
    );
  }
  if (oldAlloc.teacher_id === d.new_teacher_id) {
    return NextResponse.json(
      { error: "New teacher must be different from the current teacher." },
      { status: 400 },
    );
  }

  // ── 2. Validate new teacher ────────────────────────────────────────────────
  const newTeacher = await queryOne<{ id: string; name: string }>(
    `select id, name from teachers where id = $1 and deleted_at is null`,
    [d.new_teacher_id],
  );
  if (!newTeacher) return NextResponse.json({ error: "New teacher not found." }, { status: 404 });

  // ── 3. Transfer date must be after last delivered lecture ──────────────────
  const lastLecture = await queryOne<{ last_date: string | null }>(
    `select max(attendance_date)::text as last_date
     from attendance_records
     where allocation_id = $1`,
    [id],
  );
  if (lastLecture?.last_date && d.transfer_date <= lastLecture.last_date) {
    return NextResponse.json(
      {
        error: `Transfer date must be after the last delivered lecture (${lastLecture.last_date}). Choose a date later than ${lastLecture.last_date}.`,
      },
      { status: 400 },
    );
  }

  // ── 4. Count lectures Teacher A delivered (for lecture_seq_offset) ─────────
  const lectureCount = await queryOne<{ total: string }>(
    `select coalesce(sum(lecture_count), 0)::text as total
     from attendance_records
     where allocation_id = $1`,
    [id],
  );
  const oldDelivered       = Math.round(Number(lectureCount?.total ?? 0));
  const newSeqOffset       = oldAlloc.lecture_seq_offset + oldDelivered;

  // ── 5. Load semester rows for the old allocation ───────────────────────────
  const semesterRows = await query<{ semester_id: string; course_id: string }>(
    `select semester_id, course_id from allocation_semesters where allocation_id = $1`,
    [id],
  );
  if (semesterRows.length === 0) {
    return NextResponse.json({ error: "No semester records found for this allocation." }, { status: 400 });
  }

  // ── 6. Check no active allocation already exists for this course+semester ──
  const conflictCheck = await queryOne(
    `select 1
     from allocation_semesters als
     join allocations a on a.id = als.allocation_id
     where als.semester_id = any($1::uuid[])
       and als.course_id   = $2
       and a.status        = 'active'
       and a.id           != $3`,
    [semesterRows.map((r) => r.semester_id), oldAlloc.course_id, id],
  );
  if (conflictCheck) {
    return NextResponse.json(
      { error: "An active allocation already exists for this course in one of the semesters." },
      { status: 409 },
    );
  }

  // ── 7. Timetable conflict check for new teacher ────────────────────────────
  // Check if the new teacher has overlapping timetable slots in the same semesters
  const timetableConflict = await queryOne(
    `select 1
     from timetable_cells tc
     join allocations a   on a.id = tc.allocation_id
     join timetables  tt  on tt.id = tc.timetable_id
     join timetable_cells tc2 on tc2.timetable_id = tt.id
                              and tc2.day_id = tc.day_id
                              and tc2.period_id = tc.period_id
                              and tc2.allocation_id = $1
     where a.teacher_id = $2
       and a.id != $1
     limit 1`,
    [id, d.new_teacher_id],
  );
  if (timetableConflict) {
    return NextResponse.json(
      { error: "The new teacher has a timetable conflict with this course's scheduled slots." },
      { status: 409 },
    );
  }

  // ── 8. Determine/generate transfer_group_id ────────────────────────────────
  const transferGroupId = oldAlloc.transfer_group_id ?? crypto.randomUUID();

  const endDate = (() => {
    // end_date = transfer_date - 1 day
    const d2 = new Date(d.transfer_date);
    d2.setDate(d2.getDate() - 1);
    return d2.toISOString().slice(0, 10);
  })();

  const newAllocationType = d.allocation_type ?? oldAlloc.allocation_type;
  const newRate           = d.rate           ?? Number(oldAlloc.rate);

  // ── 9. Load course title for notification ──────────────────────────────────
  const course = await queryOne<{ title: string }>(
    `select title from courses where id = $1`,
    [oldAlloc.course_id],
  );

  // ── 10. Atomic transaction ─────────────────────────────────────────────────
  const client = await pool.connect();
  let newAllocId = "";
  try {
    await client.query("begin");

    // 10a. Close Teacher A's allocation
    await client.query(
      `update allocations
       set status            = 'transferred',
           end_date          = $1,
           transfer_group_id = $2,
           updated_at        = now()
       where id = $3`,
      [endDate, transferGroupId, id],
    );

    // 10b. Create Teacher B's allocation
    const newAllocRes = await client.query(
      `insert into allocations
         (course_id, teacher_id, allocation_type, rate, is_combined,
          status, started_at, transfer_group_id, lecture_seq_offset)
       values ($1, $2, $3, $4, $5, 'active', $6, $7, $8)
       returning id`,
      [
        oldAlloc.course_id,
        d.new_teacher_id,
        newAllocationType,
        newRate,
        oldAlloc.is_combined,
        d.transfer_date,
        transferGroupId,
        newSeqOffset,
      ],
    );
    newAllocId = newAllocRes.rows[0].id as string;

    // 10c. Copy allocation_semesters to new allocation
    for (const row of semesterRows) {
      await client.query(
        `insert into allocation_semesters (allocation_id, semester_id, course_id)
         values ($1, $2, $3)`,
        [newAllocId, row.semester_id, row.course_id],
      );
    }

    // 10d. Re-point all timetable_cells from old allocation to new allocation
    await client.query(
      `update timetable_cells set allocation_id = $1 where allocation_id = $2`,
      [newAllocId, id],
    );

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    console.error("Transfer failed:", err);
    return NextResponse.json({ error: "Transfer failed. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }

  // ── 11. Notify new teacher ─────────────────────────────────────────────────
  await query(
    `insert into notifications (recipient_type, recipient_id, title, message)
     values ('teacher', $1, $2, $3)`,
    [
      d.new_teacher_id,
      "Course transferred to you",
      `You have been assigned to teach ${course?.title ?? "a course"} effective ${d.transfer_date}. Lecture numbering continues from lecture ${newSeqOffset + 1}.`,
    ],
  ).catch((err) => console.error("Notification failed:", err));

  return NextResponse.json({
    success:        true,
    new_allocation_id: newAllocId,
    lecture_seq_offset: newSeqOffset,
  });
}
