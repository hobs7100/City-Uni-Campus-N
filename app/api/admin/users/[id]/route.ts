import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  cellno: z.string().optional().nullable(),
  role: z.enum(["admin", "hod", "coordinator"]).optional(),
  status: z.enum(["active", "blocked"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.email) {
    const existing = await queryOne(`select id from users where email = $1 and id != $2`, [
      data.email.toLowerCase(),
      id,
    ]);
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (data.name) { sets.push(`name = $${i++}`); values.push(data.name); }
  if (data.email) { sets.push(`email = $${i++}`); values.push(data.email.toLowerCase()); }
  if (data.cellno !== undefined) { sets.push(`cellno = $${i++}`); values.push(data.cellno); }
  if (data.role) { sets.push(`role = $${i++}`); values.push(data.role); }
  if (data.status) { sets.push(`status = $${i++}`); values.push(data.status); }
  sets.push(`updated_at = now()`);

  values.push(id);
  const user = await queryOne(
    `update users set ${sets.join(", ")} where id = $${i} and deleted_at is null
     returning id, name, email, cellno, role, status, created_at`,
    values
  );

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole("admin");
  if (response) return response;
  const { id } = await params;

  if (session!.userId === id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  await query(`update users set deleted_at = now(), status = 'blocked' where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
