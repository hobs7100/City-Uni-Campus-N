import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePortalPermission } from "@/lib/portalPermissions";

export async function GET() {
  const { response } = await requirePortalPermission("feedback","view","admin");
  if (response) return response;
  const rows = await query(`select f.id,f.category,f.status,f.created_at,s.name student_name,s.contact,c.class_name,c.session,
    (select term_type||' '||semester_number from semesters sem where sem.class_id=s.class_id and sem.status='active' limit 1) active_semester
    from feedback f join students s on s.id=f.student_id join classes c on c.id=s.class_id order by f.created_at desc`);
  return NextResponse.json(rows);
}