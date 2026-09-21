import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { analyticsFilterOptions, resultRows, dates, effective, uuid, zone, zoneSchema, scopeSchema, validDateRange } from "../_lib";
import { z } from "zod";
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
  type StudentZoneRow = { student_id:string; student_name:string; father_name:string|null; roll_no:string|null; class_id:string; class_name:string; session:string; semester_id:string; semester_number:number; term_type:string; test_values:Record<string,number>; total_obtained:number; total_marks:number };
  const studentMap=new Map<string,StudentZoneRow>(); grouped.forEach(rs=>{const first=rs[0], key=first.student_id; const out=studentMap.get(key)||{student_id:key,student_name:first.student_name,father_name:first.father_name,roll_no:first.roll_no,class_id:first.class_id,class_name:first.class_name,session:first.session,semester_id:first.semester_id,semester_number:first.semester_number,term_type:first.term_type,test_values:{},total_obtained:0,total_marks:0}; rs.forEach(r=>{out.test_values[`${r.test_date}:${r.test_series_id}:${r.course_id}`]=r.obtained_marks;out.total_obtained+=r.obtained_marks;out.total_marks+=r.total_marks});studentMap.set(key,out)});
  const student_rows=[...studentMap.values()].map(r=>({...r,name:r.student_name,class:r.class_name,cells:r.test_values,percentage:r.total_marks?r.total_obtained/r.total_marks*100:0,overall_percentage:r.total_marks?r.total_obtained/r.total_marks*100:0,zone:zone(r.total_marks?r.total_obtained/r.total_marks*100:0)}))
    .filter(r=>r.zone===p.data.zone).sort((a,b)=>b.percentage-a.percentage||a.name.localeCompare(b.name));
  const zone_counts={toppers:0,good:0,average:0,warning:0,danger:0}; [...studentMap.values()].forEach(r=>zone_counts[zone(r.total_marks?r.total_obtained/r.total_marks*100:0)]++);
  const details=student_rows.map(r=>({...r,section:r.class_name.toLowerCase().includes("digital leaders")?"A":r.class_name.toLowerCase().includes("digital innovators")?"B":null,tests:(grouped.get(r.student_id)||[]).slice().sort((a,b)=>a.course_title.localeCompare(b.course_title)||a.test_date.localeCompare(b.test_date)).map(x=>({date:x.test_date,course_id:x.course_id,course_code:x.course_code,course_title:x.course_title,series_name:x.series_name,obtained_marks:x.obtained_marks,total_marks:x.total_marks,percentage:x.total_marks?x.obtained_marks/x.total_marks*100:0,is_absent:x.is_absent,course:x.course_title,series:x.series_name,obtained:x.obtained_marks,total:x.total_marks}))}));
  const filter_options=await analyticsFilterOptions();
  return NextResponse.json({effective_filters:{...effective(raw,d.from,d.to),session:p.data.session||null,zone:p.data.zone,scope:p.data.scope},filter_options,tests,columns:tests,student_rows:details,rows:details,zone_counts});
}