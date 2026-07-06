import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("hod");
  if (response) return response;

  const departments = await query<{ id: string; name: string }>(
    `select id, name from departments where hod_id = $1`,
    [session!.userId]
  );
  const departmentIds = departments.map((d) => d.id);

  if (departmentIds.length === 0) {
    return NextResponse.json({
      departments: [],
      counters: { total_classes: 0, total_students: 0, active: 0, left: 0, dropped: 0, freezed: 0, struck_off: 0 },
      classes: [],
    });
  }

  const counters = await query<{
    total_classes: string;
    total_students: string;
    active: string;
    left: string;
    dropped: string;
    freezed: string;
    struck_off: string;
  }>(
    `select
       (select count(*) from classes where department_id = any($1::uuid[])) as total_classes,
       count(*) as total_students,
       count(*) filter (where st.status = 'active') as active,
       count(*) filter (where st.status = 'left') as left,
       count(*) filter (where st.status = 'dropped') as dropped,
       count(*) filter (where st.status = 'freezed') as freezed,
       count(*) filter (where st.status = 'struck_off') as struck_off
     from students st
     where st.department_id = any($1::uuid[]) and st.deleted_at is null`,
    [departmentIds]
  );

  const classes = await query(
    `select cl.id, cl.class_name, cl.session, aff.university_name,
            count(st.id) filter (where st.deleted_at is null) as total_students,
            count(st.id) filter (where st.deleted_at is null and st.status = 'active') as active_students,
            count(st.id) filter (where st.deleted_at is null and st.status = 'struck_off') as struck_off
     from classes cl
     left join affiliations aff on aff.id = cl.affiliation_id
     left join students st on st.class_id = cl.id
     where cl.department_id = any($1::uuid[])
     group by cl.id, cl.class_name, cl.session, aff.university_name
     order by cl.class_name`,
    [departmentIds]
  );

  return NextResponse.json({ departments, counters: counters[0], classes });
}
