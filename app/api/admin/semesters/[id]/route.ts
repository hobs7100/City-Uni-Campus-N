import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const closeSchema = z.object({
  close_date: z.string().min(4),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }

  const semester = await queryOne<{ id: string; status: string }>(`select id, status from semesters where id = $1`, [id]);
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });
  if (semester.status === "closed") {
    return NextResponse.json({ error: "This semester is already closed." }, { status: 409 });
  }

  const updated = await queryOne(
    `update semesters set status = 'closed', close_date = $1, updated_at = now() where id = $2 returning *`,
    [parsed.data.close_date, id]
  );
  return NextResponse.json({ semester: updated });
}
