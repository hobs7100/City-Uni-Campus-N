import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  name: z.string().min(2),
  hod_id: z.string().uuid().nullable().optional(),
  coordinator_id: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "blocked"]).default("active"),
});

export async function GET() {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const departments = await query(`
    select d.*, hu.name as hod_name, cu.name as coordinator_name
    from departments d
    left join users hu on hu.id = d.hod_id
    left join users cu on cu.id = d.coordinator_id
    order by d.created_at desc
  `);
  return NextResponse.json({ departments });
}

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await queryOne(`select id from departments where lower(name) = lower($1)`, [d.name]);
  if (existing) {
    return NextResponse.json({ error: "A department with this name already exists." }, { status: 409 });
  }

  const department = await queryOne(
    `insert into departments (name, hod_id, coordinator_id, status) values ($1, $2, $3, $4) returning *`,
    [d.name, d.hod_id || null, d.coordinator_id || null, d.status]
  );
  return NextResponse.json({ department }, { status: 201 });
}
