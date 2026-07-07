import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const departments = await query<{ id: string }>(
    `select id from departments where hod_id = $1`,
    [session!.userId]
  );
  const deptIds = departments.map((d) => d.id);
  if (deptIds.length === 0) return NextResponse.json({ students: [] });

  const students = await query<{
    id: string;
    name: string;
    roll_no: string | null;
    class_name: string;
    session: string;
    class_id: string;
  }>(
    `select s.id, s.name, s.roll_no, c.id as class_id, c.class_name, s.session
     from students s
     join classes c on c.id = s.class_id
     where s.department_id = any($1::uuid[])
       and s.deleted_at is null
     order by c.class_name, s.name`,
    [deptIds]
  );

  return NextResponse.json({ students });
}
