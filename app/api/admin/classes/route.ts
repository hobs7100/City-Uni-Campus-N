import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const typeToSemesters: Record<string, number> = { ADP: 4, DIT: 4, BS: 8, LLB: 8 };

const schema = z.object({
  department_id: z.string().uuid(),
  class_name: z.string().min(1),
  session: z.string().min(4),
  affiliation_id: z.string().uuid().nullable().optional(),
  type: z.enum(["ADP", "BS", "DIT", "LLB"]),
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

  const classes = await query(
    `select c.*, d.name as department_name, a.university_name
     from classes c
     join departments d on d.id = c.department_id
     left join affiliations a on a.id = c.affiliation_id
     ${where}
     order by c.created_at desc`,
    values
  );
  return NextResponse.json({ classes });
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
  const totalSemesters = typeToSemesters[d.type];

  const existing = await queryOne(
    `select id from classes where department_id = $1 and lower(class_name) = lower($2) and session = $3`,
    [d.department_id, d.class_name, d.session]
  );
  if (existing) {
    return NextResponse.json({ error: "A class with this name and session already exists in this department." }, { status: 409 });
  }

  const created = await queryOne(
    `insert into classes (department_id, class_name, session, affiliation_id, type, total_semesters, status)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [d.department_id, d.class_name, d.session, d.affiliation_id || null, d.type, totalSemesters, d.status]
  );
  return NextResponse.json({ class: created }, { status: 201 });
}
