import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "hod", "coordinator");
  if (response) return response;

  const search = request.nextUrl.searchParams.get("q") || "";

  const students = await query(
    `select s.id, s.name, s.roll_no, s.session, c.class_name, d.name as department_name
     from students s
     join classes c on c.id = s.class_id
     join departments d on d.id = s.department_id
     where s.deleted_at is null and ($1 = '' or s.name ilike '%' || $1 || '%' or s.roll_no ilike '%' || $1 || '%')
     order by s.name
     limit 50`,
    [search]
  );
  return NextResponse.json({ students });
}
