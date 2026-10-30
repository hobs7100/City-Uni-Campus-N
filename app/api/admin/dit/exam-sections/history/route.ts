import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(req: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const parsed = z.string().uuid().safeParse(req.nextUrl.searchParams.get("student_id"));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid student." }, { status: 400 });
  const student = await queryOne(
    `select s.id,s.name,s.roll_no,c.class_name,c.session,es.name as exam_section_name
     from students s join classes c on c.id=s.class_id
     left join dit_exam_section_memberships m on m.student_id=s.id
     left join dit_exam_sections es on es.id=m.exam_section_id
     where s.id=$1 and c.type='DIT' and s.deleted_at is null`, [parsed.data],
  );
  if (!student) return NextResponse.json({ error: "DIT student not found." }, { status: 404 });
  const [history, results] = await Promise.all([
    query(
      `select h.id,f.name as from_section_name,t.name as to_section_name,h.changed_at,u.name as changed_by_name
       from dit_exam_section_history h
       left join dit_exam_sections f on f.id=h.from_section_id
       join dit_exam_sections t on t.id=h.to_section_id
       join users u on u.id=h.changed_by
       where h.student_id=$1 order by h.changed_at desc,h.id`, [parsed.data],
    ),
    query(
      `select d.id,ts.name as series_name,co.title as course_title,d.test_date::text,
              d.obtained_marks,ts.total_marks,d.is_absent,es.name as exam_section_name
       from dit_mock_results d join dit_test_series ts on ts.id=d.test_series_id
       join allocations a on a.id=d.allocation_id join courses co on co.id=a.course_id
       left join dit_exam_sections es on es.id=d.exam_section_id
       where d.student_id=$1 order by d.test_date desc,co.title`, [parsed.data],
    ),
  ]);
  return NextResponse.json({ student, history, results });
}
