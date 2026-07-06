import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  code: z.string().min(1),
  title: z.string().min(2),
  department_id: z.string().uuid(),
  credit_hours: z.coerce.number().positive(),
  status: z.enum(["active", "blocked"]).default("active"),
});

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const departmentId = request.nextUrl.searchParams.get("department_id");
  const status = request.nextUrl.searchParams.get("status");

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (departmentId) { conditions.push(`c.department_id = $${i++}`); values.push(departmentId); }
  if (status) { conditions.push(`c.status = $${i++}`); values.push(status); }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const courses = await query(
    `select c.*, d.name as department_name
     from courses c
     join departments d on d.id = c.department_id
     ${where}
     order by c.created_at desc`,
    values
  );
  return NextResponse.json({ courses });
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

  const existing = await queryOne(
    `select id from courses where department_id = $1 and lower(code) = lower($2)`,
    [d.department_id, d.code]
  );
  if (existing) {
    return NextResponse.json({ error: "A course with this code already exists in this department." }, { status: 409 });
  }

  const created = await queryOne(
    `insert into courses (code, title, department_id, credit_hours, status)
     values ($1, $2, $3, $4, $5) returning *`,
    [d.code, d.title, d.department_id, d.credit_hours, d.status]
  );
  return NextResponse.json({ course: created }, { status: 201 });
}
