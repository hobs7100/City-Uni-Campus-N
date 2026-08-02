import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

// GET /api/admin/leave-management/students?q=<search>
// Returns students matching the search query (name / CNIC) with class info.
// Used for the leave-issue typeahead.
export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ students: [] });

  const students = await query<{
    id: string;
    name: string;
    father_name: string | null;
    cnic: string;
    class_name: string;
    session: string;
    department_name: string;
    status: string;
  }>(
    `select s.id, s.name, s.father_name, s.cnic,
            cl.class_name, cl.session,
            d.name as department_name,
            s.status
     from students s
     join classes cl      on cl.id = s.class_id
     join departments d   on d.id  = s.department_id
     where s.deleted_at is null
       and (s.name ilike $1 or s.cnic ilike $1 or s.father_name ilike $1)
     order by s.name asc
     limit 20`,
    [`%${q}%`]
  );

  return NextResponse.json({ students });
}
