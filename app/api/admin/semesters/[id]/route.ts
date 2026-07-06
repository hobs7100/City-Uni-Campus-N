import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const closeSchema = z.object({
  close_date: z.string().min(4),
});

const detailsSchema = z.object({
  term_type: z.enum(["Fall", "Spring"]).optional(),
  start_date: z.string().min(4).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);

  const semester = await queryOne<{ id: string; status: string }>(`select id, status from semesters where id = $1`, [id]);
  if (!semester) return NextResponse.json({ error: "Semester not found." }, { status: 404 });

  if (body && typeof body === "object" && "close_date" in body) {
    const parsed = closeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
    }
    if (semester.status === "closed") {
      return NextResponse.json({ error: "This semester is already closed." }, { status: 409 });
    }
    const updated = await queryOne(
      `update semesters set status = 'closed', close_date = $1, updated_at = now() where id = $2 returning *`,
      [parsed.data.close_date, id]
    );
    return NextResponse.json({ semester: updated });
  }

  const parsed = detailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;
  if (!d.term_type && !d.start_date) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }
  if (semester.status === "closed") {
    return NextResponse.json({ error: "Cannot edit a closed semester." }, { status: 409 });
  }

  const updated = await queryOne(
    `update semesters set
       term_type = coalesce($1, term_type),
       start_date = coalesce($2, start_date),
       updated_at = now()
     where id = $3 returning *`,
    [d.term_type ?? null, d.start_date ?? null, id]
  );
  return NextResponse.json({ semester: updated });
}
