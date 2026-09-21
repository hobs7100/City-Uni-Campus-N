import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { analyticsFilterOptions, resultRows, dates, effective, uuid, zone, validDateRange } from "./_lib";
import { z } from "zod";
const params = z.object({ from_date: z.string().date().optional(), to_date: z.string().date().optional(),
  test_series_id: uuid.optional(), class_id: uuid.optional(), semester_id: uuid.optional(), course_id: uuid.optional(), session: z.string().min(1).optional() });
export async function GET(req: NextRequest) {
  const { response } = await requireRole("admin", "coordinator"); if (response) return response;
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries()); const parsed = params.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const d = dates(parsed.data.from_date, parsed.data.to_date);
  if (!validDateRange(d.from, d.to)) return NextResponse.json({ error: "from_date must not be after to_date." }, { status: 400 });
  const rows = await resultRows({ from:d.from, to:d.to, testSeriesId:parsed.data.test_series_id, classId:parsed.data.class_id, semesterId:parsed.data.semester_id, courseId:parsed.data.course_id, session:parsed.data.session });
  const map = new Map<string, typeof rows>();
  for (const r of rows) { const a = map.get(r.course_id) || []; a.push(r); map.set(r.course_id, a); }
  const subjects = [...map.values()].map(rs => {
    const students = new Map<string, { obtained:number; total:number; zone?:string }>();
    rs.forEach(r => { const x=students.get(r.student_id)||{obtained:0,total:0}; x.obtained+=r.obtained_marks; x.total+=r.total_marks; students.set(r.student_id,x); });
    const obtained=rs.reduce((n,r)=>n+r.obtained_marks,0), total=rs.reduce((n,r)=>n+r.total_marks,0);
    const zones={toppers:0,good:0,average:0,warning:0,danger:0}; students.forEach(x=>zones[zone(x.total?x.obtained/x.total*100:0)]++);
    const r=rs[0]; const distinct_test_count=new Set(rs.map(x=>`${x.test_date}:${x.test_series_id}`)).size;
    return { course_id:r.course_id, title:r.course_title, code:r.course_code, distinct_test_count, test_count:distinct_test_count,
      student_count:students.size, total_attempted_result_rows:rs.length, passing_percentage:rs.length?rs.filter(x=>!x.is_absent&&x.obtained_marks>=x.passing_marks).length/rs.length*100:0,
      normalized_average_percentage:total?obtained/total*100:0, average_percentage:total?obtained/total*100:0, zone_counts:zones, zones };
  });
  const filter_options = await analyticsFilterOptions();
  return NextResponse.json({ effective_filters:{...effective(raw,d.from,d.to),session:parsed.data.session || null}, filter_options, subjects,
    summary:{unique_student_count:new Set(rows.map(r=>r.student_id)).size,distinct_test_count:new Set(rows.map(r=>`${r.test_date}:${r.test_series_id}`)).size} });
}