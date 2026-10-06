import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { analyticsFilterOptions, resultRows, dates, effective, uuid, zoneSchema, scopeSchema, validDateRange } from "../_lib";
import { z } from "zod";
import { studentResults } from "../_students";
const schema=z.object({from_date:z.string().date().optional(),to_date:z.string().date().optional(),test_series_id:uuid.optional(),class_id:uuid.optional(),semester_id:uuid.optional(),course_id:uuid.optional(),session:z.string().min(1).optional(),zone:zoneSchema.default("toppers"),scope:scopeSchema.default("overall")});
export async function GET(req:NextRequest){
  const {response}=await requireRole("admin","coordinator"); if(response)return response;
  const raw=Object.fromEntries(req.nextUrl.searchParams.entries()); const p=schema.safeParse(raw);
  if(!p.success)return NextResponse.json({error:p.error.issues[0]?.message},{status:400});
  if(p.data.scope==="subject"&&!p.data.course_id)return NextResponse.json({error:"course_id is required for subject scope."},{status:400});
  const d=dates(p.data.from_date,p.data.to_date);
  if(!validDateRange(d.from,d.to))return NextResponse.json({error:"from_date must not be after to_date."},{status:400});
  const rows=await resultRows({...d,testSeriesId:p.data.test_series_id,classId:p.data.class_id,semesterId:p.data.semester_id,courseId:p.data.course_id,session:p.data.session});
  const grouped=new Map<string,typeof rows>(); rows.forEach(r=>{const k=r.student_id;const x=grouped.get(k)||[];x.push(r);grouped.set(k,x);});
  const tests=[...new Map(rows.map(r=>{const id=`${r.test_date}:${r.test_series_id}:${r.course_id}`;return[id,{id,key:id,label:`${r.test_date} · ${r.series_name}${p.data.scope==="overall"?` · ${r.course_title}`:""}`,date:r.test_date,test_series_id:r.test_series_id,series_name:r.series_name,course_id:r.course_id,course_title:r.course_title,total_marks:r.total_marks}]})).values()];
  const allStudents=studentResults(rows).map(r=>{
    const cells=Object.fromEntries((grouped.get(r.student_id)||[]).map(x=>[`${x.test_date}:${x.test_series_id}:${x.course_id}`,x.obtained_marks]));
    return {...r,cells,test_values:cells};
  });
  const student_rows=allStudents.filter(r=>r.zone===p.data.zone);
  const zone_counts={toppers:0,good:0,average:0,warning:0,danger:0}; allStudents.forEach(r=>zone_counts[r.zone]++);
  const details=student_rows.map(r=>({...r,section:r.class_name.toLowerCase().includes("digital leaders")?"A":r.class_name.toLowerCase().includes("digital innovators")?"B":null,tests:(grouped.get(r.student_id)||[]).slice().sort((a,b)=>a.course_title.localeCompare(b.course_title)||a.test_date.localeCompare(b.test_date)).map(x=>({date:x.test_date,course_id:x.course_id,course_code:x.course_code,course_title:x.course_title,series_name:x.series_name,obtained_marks:x.obtained_marks,total_marks:x.total_marks,percentage:x.total_marks?x.obtained_marks/x.total_marks*100:0,is_absent:x.is_absent,course:x.course_title,series:x.series_name,obtained:x.obtained_marks,total:x.total_marks}))}));
  const filter_options=await analyticsFilterOptions();
  return NextResponse.json({effective_filters:{...effective(raw,d.from,d.to),session:p.data.session||null,zone:p.data.zone,scope:p.data.scope},filter_options,tests,columns:tests,student_rows:details,rows:details,zone_counts});
}