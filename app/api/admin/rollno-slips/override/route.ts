import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const allowSchema = z.object({
  student_id: z.string().uuid(),
  notes:      z.string().optional().nullable(),
});

// POST — grant override (upsert so re-granting refreshes the record)
export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("admin", "hod");
  if (response) return response;
  if (session!.role === "assistant") return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const body   = await request.json().catch(() => null);
  const parsed = allowSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const { student_id, notes } = parsed.data;

  const student = await queryOne(
    `SELECT id FROM students WHERE id = $1 AND deleted_at IS NULL`,
    [student_id]
  );
  if (!student)
    return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const row = await queryOne(
    `INSERT INTO rollno_slip_overrides (student_id, allowed_by, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_id) DO UPDATE
       SET allowed_by = excluded.allowed_by,
           allowed_at = now(),
           notes      = excluded.notes
     RETURNING id, allowed_at`,
    [student_id, session!.userId, notes ?? null]
  );

  return NextResponse.json({ override: row }, { status: 200 });
}

// DELETE — revoke override
export async function DELETE(request: NextRequest) {
  const { session, response } = await requireRole("admin", "hod");
  if (response) return response;
  if (session!.role === "assistant") return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const body       = await request.json().catch(() => null);
  const studentId  = body?.student_id as string | undefined;
  if (!studentId || typeof studentId !== "string")
    return NextResponse.json({ error: "student_id required." }, { status: 400 });

  await query(
    `DELETE FROM rollno_slip_overrides WHERE student_id = $1`,
    [studentId]
  );

  return NextResponse.json({ ok: true });
}
