import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(req: NextRequest) {
  const { session, response } = await requireRole("teacher");
  if (response) return response;
  const parsed = z.string().uuid().safeParse(req.nextUrl.searchParams.get("semester_id"));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid semester." }, { status: 400 });
  const sections = await query(
    `select es.id,es.name,es.date::text,count(s.id)::int as student_count
     from dit_exam_sections es join dit_exam_section_memberships m on m.exam_section_id=es.id
     join students s on s.id=m.student_id and s.deleted_at is null and s.status='active'
     join semesters sem on sem.class_id=s.class_id and sem.id=$1 and sem.status='active'
     join classes c on c.id=sem.class_id and c.type='DIT'
     where exists(select 1 from allocations a join allocation_semesters als on als.allocation_id=a.id
                  where als.semester_id=sem.id and a.teacher_id=$2 and a.status='active')
     group by es.id order by es.name`, [parsed.data, session!.userId],
  );
  return NextResponse.json({ sections });
}
