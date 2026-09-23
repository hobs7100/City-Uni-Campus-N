import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePortalPermission } from "@/lib/portalPermissions";

export async function GET() {
  const { session, response } = await requirePortalPermission("feedback","view","admin");
  if (response) return response;
  const rows = await query(`select f.id,f.category,f.status,f.created_at,s.name student_name,s.contact,c.class_name,c.session,
    (select term_type||' '||semester_number from semesters sem where sem.class_id=s.class_id and sem.status='active' limit 1) active_semester,
    ((case when reads.read_at is null then 1 else 0 end) +
      (select count(*)::int from feedback_comments fc
       where fc.feedback_id=f.id and fc.author_role='student'
         and not exists (select 1 from feedback_admin_comment_reads receipt
                         where receipt.admin_id=$1 and receipt.comment_id=fc.id)))::int as unread_count
    from feedback f
    join students s on s.id=f.student_id
    join classes c on c.id=s.class_id
    left join feedback_admin_reads reads on reads.feedback_id=f.id and reads.admin_id=$1
    order by f.created_at desc`, [session!.userId]);
  return NextResponse.json(rows);
}