import type { PoolClient } from "pg";

export class ExamSectionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Caller owns the transaction. Student locks serialize moves and result entry. */
export async function assignDitExamSection(
  client: PoolClient, studentIds: string[], examSectionId: string, changedBy: string,
) {
  if (new Set(studentIds).size !== studentIds.length)
    throw new ExamSectionError("Select each student only once.", 400);
  const section = await client.query("select id from dit_exam_sections where id=$1 for key share", [examSectionId]);
  if (!section.rowCount) throw new ExamSectionError("Exam section not found.", 404);
  const students = await client.query(
    `select s.id from students s join classes c on c.id=s.class_id
     where s.id=any($1::uuid[]) and c.type='DIT' and s.deleted_at is null
     order by s.id for update of s`,
    [studentIds],
  );
  if (students.rowCount !== studentIds.length)
    throw new ExamSectionError("Every selected student must be a non-deleted DIT student.", 400);
  const changed = await client.query(
    `insert into dit_exam_section_memberships as m(student_id,exam_section_id,changed_by)
     select student_id,$2,$3 from unnest($1::uuid[]) as student_id
     order by student_id
     on conflict(student_id) do update
       set exam_section_id=excluded.exam_section_id,changed_by=excluded.changed_by,assigned_at=now()
       where m.exam_section_id is distinct from excluded.exam_section_id
     returning student_id`,
    [studentIds, examSectionId, changedBy],
  );
  return changed.rowCount ?? 0;
}
