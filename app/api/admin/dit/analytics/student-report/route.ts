import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { resultRows, dates, effective, uuid, zone, validDateRange } from "../_lib";
import { query } from "@/lib/db";
import { z } from "zod";
import { ditGradeFromPercentage } from "@/lib/dit-grades";
const schema=z.object({student_id:uuid,from_date:z.string().date().optional(),to_date:z.string().date().optional(),test_series_id:uuid.optional(),class_id:uuid.optional(),semester_id:uuid.optional(),course_id:uuid.optional(),session:z.string().min(1).optional()});
export async function GET(req:NextRequest){
  const {response}=await requireRole("admin","coordinator");if(response)return response;
  const raw=Object.fromEntries(req.nextUrl.searchParams.entries());const p=schema.safeParse(raw);if(!p.success)return NextResponse.json({error:p.error.issues[0]?.message},{status:400});
  const d=dates(p.data.from_date,p.data.to_date);if(!validDateRange(d.from,d.to))return NextResponse.json({error:"from_date must not be after to_date."},{status:400});const rows=await resultRows({from:d.from,to:d.to,studentId:p.data.student_id,testSeriesId:p.data.test_series_id,classId:p.data.class_id,semesterId:p.data.semester_id,courseId:p.data.course_id,session:p.data.session});
  if(!rows.length)return NextResponse.json({error:"Student has no DIT results in the selected period."},{status:404});
  // Daily attendance is recorded by coordinators/admins, not by course teachers.
  // Use the same inclusive report dates as the test results, without restricting
  // attendance to the dates on which a test happened.
  const attendance_months = await query<{month:string;presents:number;absents:number;leaves:number}>(
    `select to_char(attendance_date, 'YYYY-MM') as month,
            count(*) filter (where status = 'present')::int as presents,
            count(*) filter (where status = 'absent')::int as absents,
            count(*) filter (where status = 'leave')::int as leaves
     from student_attendance_records
     where student_id = $1 and attendance_date >= $2::date and attendance_date <= $3::date
     group by 1 order by 1`,
    [p.data.student_id,d.from,d.to]
  );
  const monthlyResults = new Map<string, {month:string;obtained:number;total:number;tests:number}>();
  for (const row of rows) {
    const month = row.test_date.slice(0, 7);
    const point = monthlyResults.get(month) ?? {month,obtained:0,total:0,tests:0};
    point.obtained += row.obtained_marks;
    point.total += row.total_marks;
    point.tests++;
    monthlyResults.set(month, point);
  }
  const result_months = [...monthlyResults.values()].sort((a,b)=>a.month.localeCompare(b.month));
  const identity=await query(`select s.id,s.name,s.father_name,s.roll_no,s.profile_image_url,c.class_name,s.session
    from students s join classes c on c.id=s.class_id where s.id=$1 and s.deleted_at is null`,[p.data.student_id]);
  const courses=new Map<string,typeof rows>();rows.forEach(r=>{const x=courses.get(r.course_id)||[];x.push(r);courses.set(r.course_id,x)});
  const course_rows=[...courses.values()].map(rs=>{const r=rs[0],obt=rs.reduce((a,x)=>a+x.obtained_marks,0),tot=rs.reduce((a,x)=>a+x.total_marks,0),percentage=tot?obt/tot*100:0;return{course_id:r.course_id,course_title:r.course_title,course_code:r.course_code,tests:rs,obtained_marks:obt,total_marks:tot,percentage,grade:ditGradeFromPercentage(percentage),zone:zone(percentage)}}).sort((a,b)=>a.course_title.localeCompare(b.course_title)||a.course_code.localeCompare(b.course_code)||a.course_id.localeCompare(b.course_id));
  const obtained=rows.reduce((a,r)=>a+r.obtained_marks,0),total=rows.reduce((a,r)=>a+r.total_marks,0);
  const percentage=total?obtained/total*100:0;
  const r=rows[0]; const test_rows=rows.slice().sort((a,b)=>a.course_title.localeCompare(b.course_title)||a.course_code.localeCompare(b.course_code)||a.test_date.localeCompare(b.test_date)||a.series_name.localeCompare(b.series_name)).map((x,i)=>{const percentage=x.total_marks?x.obtained_marks/x.total_marks*100:0;return{test_number:i+1,date:x.test_date,subject_id:x.course_id,course_id:x.course_id,course_code:x.course_code,course_title:x.course_title,series_name:x.series_name,obtained_marks:x.obtained_marks,total_marks:x.total_marks,series:x.series_name,obtained:x.obtained_marks,total:x.total_marks,percentage,grade:x.is_absent?"Absent":ditGradeFromPercentage(percentage),is_absent:x.is_absent}});
  const profile=identity[0] as {class_name?:string;session?:string;profile_image_url?:string|null}|undefined;
  const student={...(identity[0]||{id:r.student_id,name:r.student_name,father_name:r.father_name,roll_no:r.roll_no}),profile_image_url:profile?.profile_image_url||null};
  const classInfo={id:r.class_id,name:r.class_name,session:r.session,section:profile?.class_name?.toLowerCase().includes("digital leaders")?"A":profile?.class_name?.toLowerCase().includes("digital innovators")?"B":null};
  return NextResponse.json({student,profile_image_url:profile?.profile_image_url||null,section:classInfo.section,class:classInfo,semester:{id:r.semester_id,number:r.semester_number,term_type:r.term_type},effective_filters:{...effective(raw,d.from,d.to),session:p.data.session||null},from_date:d.from,to_date:d.to,courses:course_rows,test_rows,attendance_months,result_months,report_generated_at:new Date().toISOString(),grand_totals:{obtained,total,percentage,obtained_marks:obtained,total_marks:total,overall_percentage:percentage,grade:ditGradeFromPercentage(percentage),zone:zone(percentage)}});
}