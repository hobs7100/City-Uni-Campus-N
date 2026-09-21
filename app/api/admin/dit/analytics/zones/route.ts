import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { resultRows, dates, effective, uuid, zone, zoneSchema, scopeSchema, validDateRange } from "../_lib";
import { z } from "zod";
const schema=z.object({from_date:z.string().date().optional(),to_date:z.string().date().optional(),test_series_id:uuid.optional(),class_id:uuid.optional(),semester_id:uuid.optional(),course_id:uuid.optional(),zone:zoneSchema,scope:scopeSchema});
export async function GET(req:NextRequest){
  const {response}=await requireRole("admin","coordinator"); if(response)return response;
  const raw=Object.fromEntries(req.nextUrl.searchParams.entries()); const p=schema.safeParse(raw);
  if(!p.success)return NextResponse.json({error:p.error.issues[0]?.message},{status:400});
  if(p.data.scope==="subject"&&!p.data.course_id)return NextResponse.json({error:"course_id is required for subject scope."},{status:400});
  const d=dates(p.data.from_date,p.data.to_date);
  if(!validDateRange(d.from,d.to))return NextResponse.json({error:"from_date must not be after to_date."},{status:400});
  const rows=await resultRows({...d,testSeriesId:p.data.test_series_id,classId:p.data.class_id,semesterId:p.data.semester_id,courseId:p.data.scope==="subject"?p.data.course_id:undefined});
  const grouped=new Map<string,typeof rows>(); rows.forEach(r=>{const k=r.student_id;const x=grouped.get(k)||[];x.push(r);grouped.set(k,x);});
  const eligible=new Map<string,typeof rows>(); grouped.forEach((rs,k)=>{const pct=rs.reduce((a,r)=>a+r.obtained_marks,0)/rs.reduce((a,r)=>a+r.total_marks,0)*100;if(zone(pct)===p.data.zone)eligible.set(k,rs);});
  const tests=[...new Map(rows.map(r=>{const id=`${r.test_date}:${r.test_series_id}:${r.course_id}`;return[id,{id,key:id,label:`${r.test_date} · ${r.series_name}${p.data.scope==="overall"?` · ${r.course_title}`:""}`,date:r.test_date,test_series_id:r.test_series_id,series_name:r.series_name,course_id:r.course_id,course_title:r.course_title,total_marks:r.total_marks}]})).values()];
  type StudentZoneRow = { student_id:string; student_name:string; father_name:string|null; roll_no:string|null; class_id:string; class_name:string; session:string; semester_id:string; semester_number:number; term_type:string; test_values:Record<string,number>; total_obtained:number; total_marks:number };
  const studentMap=new Map<string,StudentZoneRow>(); eligible.forEach(rs=>{const first=rs[0], key=first.student_id; const out=studentMap.get(key)||{student_id:key,student_name:first.student_name,father_name:first.father_name,roll_no:first.roll_no,class_id:first.class_id,class_name:first.class_name,session:first.session,semester_id:first.semester_id,semester_number:first.semester_number,term_type:first.term_type,test_values:{},total_obtained:0,total_marks:0}; rs.forEach(r=>{out.test_values[`${r.test_date}:${r.test_series_id}:${r.course_id}`]=r.obtained_marks;out.total_obtained+=r.obtained_marks;out.total_marks+=r.total_marks});studentMap.set(key,out)});
  const student_rows=[...studentMap.values()].map(r=>({...r,name:r.student_name,class:r.class_name,cells:r.test_values,percentage:r.total_marks?r.total_obtained/r.total_marks*100:0,overall_percentage:r.total_marks?r.total_obtained/r.total_marks*100:0,zone:p.data.zone}));
  return NextResponse.json({effective_filters:{...effective(raw,d.from,d.to),zone:p.data.zone,scope:p.data.scope},tests,columns:tests,student_rows,rows:student_rows});
}