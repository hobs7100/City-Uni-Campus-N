import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole, requireExactRole } from "@/lib/requireRole";

export async function GET() {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const sections = await query(
    `select es.id, es.name, es.date::text, count(s.id)::int as student_count
     from dit_exam_sections es
     left join dit_exam_section_memberships m on m.exam_section_id = es.id
     left join students s on s.id = m.student_id and s.deleted_at is null
     group by es.id order by es.date desc, es.name`,
  );
  return NextResponse.json({ sections });
}

const schema = z.object({ name: z.string().trim().min(1).max(150), date: z.string().date() });
export async function POST(req: NextRequest) {
  const { session, response } = await requireExactRole("admin");
  if (response) return response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a section name and valid date." }, { status: 400 });
  try {
    const section = await queryOne(
      `insert into dit_exam_sections(name,date,created_by) values($1,$2,$3)
       returning id,name,date::text`,
      [parsed.data.name, parsed.data.date, session!.userId],
    );
    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      return NextResponse.json({ error: "An exam section with this name already exists." }, { status: 409 });
    console.error("DIT exam section creation failed", error);
    return NextResponse.json({ error: "Could not create exam section." }, { status: 500 });
  }
}
