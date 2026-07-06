import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  university_name: z.string().min(2),
  mid_marks: z.coerce.number().min(0),
  sessional_marks: z.coerce.number().min(0),
  final_marks: z.coerce.number().min(0),
  practical_marks: z.coerce.number().min(0),
  status: z.enum(["active", "blocked"]).default("active"),
});

export async function GET() {
  const { response } = await requireRole("admin");
  if (response) return response;
  const affiliations = await query(`select * from affiliations order by created_at desc`);
  return NextResponse.json({ affiliations });
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

  const existing = await queryOne(`select id from affiliations where lower(university_name) = lower($1)`, [
    d.university_name,
  ]);
  if (existing) {
    return NextResponse.json({ error: "This university is already registered." }, { status: 409 });
  }

  const affiliation = await queryOne(
    `insert into affiliations (university_name, mid_marks, sessional_marks, final_marks, practical_marks, status)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [d.university_name, d.mid_marks, d.sessional_marks, d.final_marks, d.practical_marks, d.status]
  );
  return NextResponse.json({ affiliation }, { status: 201 });
}
