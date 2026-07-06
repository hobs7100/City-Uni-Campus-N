import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { generateRandomPassword, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  name: z.string().min(2),
  father_name: z.string().optional().nullable(),
  cnic: z.string().min(5),
  contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email(),
  department_id: z.string().uuid(),
  session: z.string().min(1),
  class_id: z.string().uuid(),
  profile_image_url: z.string().optional().nullable(),
  status: z.enum(["active", "struck_off", "left", "dropped", "freezed"]).default("active"),
  status_change_date: z.string().optional().nullable(),
  status_change_semester: z.coerce.number().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const classId = request.nextUrl.searchParams.get("class_id");

  const conditions: string[] = ["s.deleted_at is null"];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`s.department_id = $${i++}`); values.push(departmentId); }
  if (classId) { conditions.push(`s.class_id = $${i++}`); values.push(classId); }

  const students = await query(
    `select s.id, s.name, s.father_name, s.cnic, s.contact, s.address, s.email,
            s.department_id, d.name as department_name, s.session, s.class_id, c.class_name,
            s.profile_image_url, s.status, s.status_change_date, s.status_change_semester, s.created_at
     from students s
     join departments d on d.id = s.department_id
     join classes c on c.id = s.class_id
     where ${conditions.join(" and ")}
     order by s.created_at desc`,
    values
  );
  return NextResponse.json({ students });
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

  const [cnicExists, emailExists] = await Promise.all([
    queryOne(`select id from students where cnic = $1`, [d.cnic]),
    queryOne(`select id from students where email = $1`, [d.email.toLowerCase()]),
  ]);
  if (cnicExists) return NextResponse.json({ error: "A student with this CNIC already exists." }, { status: 409 });
  if (emailExists) return NextResponse.json({ error: "A student with this email already exists." }, { status: 409 });

  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);

  const needsStatusFields = ["left", "dropped", "freezed"].includes(d.status);

  const student = await queryOne(
    `insert into students
      (name, father_name, cnic, contact, address, email, password_hash, department_id, session, class_id,
       profile_image_url, status, status_change_date, status_change_semester)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning id, name, email, status`,
    [
      d.name,
      d.father_name || null,
      d.cnic,
      d.contact || null,
      d.address || null,
      d.email.toLowerCase(),
      passwordHash,
      d.department_id,
      d.session,
      d.class_id,
      d.profile_image_url || null,
      d.status,
      needsStatusFields ? d.status_change_date || null : null,
      needsStatusFields ? d.status_change_semester ?? null : null,
    ]
  );

  // NOTE: In production this generated password should be emailed to the student.
  // Email delivery is not configured in this environment; it is returned here so
  // it can be shared with the student manually.
  return NextResponse.json({ student, generatedPassword }, { status: 201 });
}
