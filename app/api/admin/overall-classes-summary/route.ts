import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  const { response } = await requireRole("admin");
  if (response) return response;

  const rows = await query<{
    university_name: string;
    class_id: string;
    session: string;
    class_name: string;
    semester_number: number;
    start_date: string;
    mid_term_status: "conducted" | "pending";
    mid_term_date: string | null;
    re_mid_term_status: "conducted" | "pending";
    re_mid_term_date: string | null;
  }>(
    `select
       coalesce(af.university_name, 'Unassigned University') as university_name,
       c.id as class_id,
       c.session,
       c.class_name,
       s.semester_number,
       to_char(s.start_date, 'YYYY-MM-DD') as start_date,
       case when min(med.paper_date) is null then 'pending' else 'conducted' end as mid_term_status,
       to_char(min(med.paper_date), 'DD-MM-YYYY') as mid_term_date,
       case when min(rmd.paper_date) is null then 'pending' else 'conducted' end as re_mid_term_status,
       to_char(min(rmd.paper_date), 'DD-MM-YYYY') as re_mid_term_date
     from semesters s
     join classes c on c.id = s.class_id
     left join affiliations af on af.id = c.affiliation_id
     left join mid_exam_datesheets med
       on med.semester_id = s.id
       and med.paper_date is not null
     left join re_mid_exam_datesheets rmd
       on rmd.semester_id = s.id
       and rmd.paper_date is not null
     where s.status = 'active'
     group by af.university_name, c.id, c.session, c.class_name, s.semester_number, s.start_date
     order by coalesce(af.university_name, 'Unassigned University'),
              c.class_name,
              c.session,
              s.semester_number`,
  );

  return NextResponse.json(
    { rows },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}