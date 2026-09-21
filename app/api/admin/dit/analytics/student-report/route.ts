import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { resultRows, dates, effective, uuid, zone, validDateRange } from "../_lib";
import { query } from "@/lib/db";
import { z } from "zod";
const schema=z.object({student_id:uuid,from_date:z.string().date().optional(),to_date:z.string().date().optional(),test_series_id:uuid.optional(),class_id:uuid.optional(),semester_id:uuid.optional(),course_id:uuid.optional()});
export async function GET(req:NextRequest){
  const {response}=await requireRole("admin","coordinator");if(response)return response;
  const raw=Object.fromEntries(req.nextUrl.searchParams.entries());const p=schema.safeParse(raw);if(!p.success)return NextResponse.json({error:p.error.issues[0]?.message},{status:400});
  const d=dates(p.data.from_date,p.data.to_date);if(!validDateRange(d.from,d.to))return NextResponse.json({error:"from_date must not be after to_date."},{status:400});const rows=await resultRows({from:d.from,to:d.to,studentId:p.data.student_id,testSeriesId:p.data.test_series_id,classId:p.data.class_id,semesterId:p.data.semester_id,courseId:p.data.course_id});
  if(!rows.length)return NextResponse.json({error:"Student has no DIT results in the selected period."},{status:404});
  const identity=await query(`select id,name,father_name,roll_no from students where id=$1 and deleted_at is null`,[p.data.student_id]);
  const courses=new Map<string,typeof rows>();rows.forEach(r=>{const x=courses.get(r.course_id)||[];x.push(r);courses.set(r.course_id,x)});
  const course_rows=[...courses.values()].map(rs=>{const r=rs[0],obt=rs.reduce((a,x)=>a+x.obtained_marks,0),tot=rs.reduce((a,x)=>a+x.total_marks,0);return{course_id:r.course_id,course_title:r.course_title,course_code:r.course_code,tests:rs,obtained_marks:obt,total_marks:tot,percentage:tot?obt/tot*100:0,zone:zone(tot?obt/tot*100:0)}});
  const obtained=rows.reduce((a,r)=>a+r.obtained_marks,0),total=rows.reduce((a,r)=>a+r.total_marks,0);
  const percentage=total?obtained/total*100:0;
  const r=rows[0];return NextResponse.json({student:identity[0]||{id:r.student_id,name:r.student_name,father_name:r.father_name,roll_no:r.roll_no},class:{id:r.class_id,name:r.class_name,session:r.session},semester:{id:r.semester_id,number:r.semester_number,term_type:r.term_type},effective_filters:effective(raw,d.from,d.to),courses:course_rows,grand_totals:{obtained,total,percentage,obtained_marks:obtained,total_marks:total,overall_percentage:percentage,zone:zone(percentage)}});
}