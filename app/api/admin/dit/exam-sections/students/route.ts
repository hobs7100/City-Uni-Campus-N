import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

const schema = z.object({
  exam_section_id: z.union([z.string().uuid(), z.literal("unassigned")]).optional(),
  class_id: z.string().uuid().optional(),
  q: z.string().trim().max(150).optional(),
});
export async function GET(req: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid student filters." }, { status: 400 });
  const p = parsed.data;
  const [students, classes] = await Promise.all([
    query(
      `select s.id,s.name,s.father_name,s.roll_no,s.class_id,c.class_name,c.session,
              m.exam_section_id,es.name as exam_section_name
       from students s join classes c on c.id=s.class_id
       left join dit_exam_section_memberships m on m.student_id=s.id
       left join dit_exam_sections es on es.id=m.exam_section_id
       where c.type='DIT' and s.deleted_at is null
         and ($1::text is null or ($1='unassigned' and m.student_id is null) or m.exam_section_id::text=$1)
         and ($2::uuid is null or s.class_id=$2)
         and ($3::text is null or s.name ilike $3 or s.roll_no ilike $3)
       order by c.session desc,c.class_name,s.roll_no asc nulls last,s.name,s.id`,
      [p.exam_section_id ?? null, p.class_id ?? null, p.q ? `%${p.q}%` : null],
    ),
    query(`select id,class_name as name,session from classes where type='DIT' order by session desc,class_name`),
  ]);
  return NextResponse.json({ students, classes });
}
