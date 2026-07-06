import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const student = await queryOne(
    `select st.id, st.name, st.father_name, st.cnic, st.contact, st.address, st.email,
            st.profile_image_url, st.status, st.status_change_date, st.status_change_semester,
            st.session, d.name as department_name, cl.class_name, cl.id as class_id
     from students st
     join departments d on d.id = st.department_id
     join classes cl on cl.id = st.class_id
     where st.id = $1 and st.deleted_at is null`,
    [session!.userId]
  );
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  return NextResponse.json({ student });
}

const patchSchema = z.object({
  contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  current_password: z.string().optional(),
  new_password: z.string().min(6).optional(),
});

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  if (d.new_password) {
    if (!d.current_password) {
      return NextResponse.json({ error: "Current password is required to set a new password." }, { status: 400 });
    }
    const student = await queryOne<{ password_hash: string }>(`select password_hash from students where id = $1`, [session!.userId]);
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const valid = await bcrypt.compare(d.current_password, student.password_hash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    const newHash = await bcrypt.hash(d.new_password, 10);
    await queryOne(`update students set password_hash = $1, updated_at = now() where id = $2`, [newHash, session!.userId]);
  }

  const student = await queryOne(
    `update students set
       contact = coalesce($1, contact),
       address = coalesce($2, address),
       updated_at = now()
     where id = $3
     returning id, name, contact, address`,
    [d.contact ?? null, d.address ?? null, session!.userId]
  );

  return NextResponse.json({ student });
}
