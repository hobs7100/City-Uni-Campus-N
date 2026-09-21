import { NextRequest, NextResponse } from "next/server";
import { query, getClient } from "@/lib/db";
import { requirePortalPermission } from "@/lib/portalPermissions";
import { feedbackStatuses, commentSchema } from "@/lib/feedback";
import { z } from "zod";
const statusSchema = z.object({ status: z.enum(feedbackStatuses) });
export async function GET(_: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {response}=await requirePortalPermission("feedback","view","admin"); if(response)return response;
  const {id}=await params; const f=await query(`select f.*,s.name student_name,s.contact,c.class_name,c.session from feedback f join students s on s.id=f.student_id join classes c on c.id=s.class_id where f.id=$1`,[id]);
  if(!f[0])return NextResponse.json({error:"Not found."},{status:404});
  const [attachments,comments,history]=await Promise.all([
    query(`select id,url,public_id,created_at from feedback_attachments where feedback_id=$1 order by created_at`,[id]),
    query(`select id,author_role,body,created_at from feedback_comments where feedback_id=$1 order by created_at`,[id]),
    query(`select id,status,created_at from feedback_status_history where feedback_id=$1 order by created_at`,[id])]);
  return NextResponse.json({complaint:f[0],attachments,comments,status_history:history});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {session,response}=await requirePortalPermission("feedback","edit","admin"); if(response)return response;
  const {id}=await params; const data=await request.json().catch(()=>null);
  const comment=commentSchema.safeParse(data); if(!comment.success)return NextResponse.json({error:comment.error.flatten()},{status:400});
  const exists=await query(`select id from feedback where id=$1`,[id]); if(!exists[0])return NextResponse.json({error:"Not found."},{status:404});
  await query(`insert into feedback_comments(feedback_id,author_id,author_role,body) values($1,$2,'admin',$3)`,[id,session!.userId,comment.data.body]);
  return NextResponse.json({ok:true},{status:201});
}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {session,response}=await requirePortalPermission("feedback","edit","admin"); if(response)return response;
  const {id}=await params; const parsed=statusSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:parsed.error.flatten()},{status:400});
  const client=await getClient();
  try { await client.query("begin"); const old=await client.query(`select status from feedback where id=$1 for update`,[id]);
    if(!old.rows[0]){await client.query("rollback");return NextResponse.json({error:"Not found."},{status:404});}
    if(old.rows[0].status!==parsed.data.status){await client.query(`update feedback set status=$1,updated_at=now() where id=$2`,[parsed.data.status,id]);await client.query(`insert into feedback_status_history(feedback_id,status,changed_by) values($1,$2,$3)`,[id,parsed.data.status,session!.userId]);}
    await client.query("commit"); return NextResponse.json({ok:true});
  } catch {await client.query("rollback");return NextResponse.json({error:"Unable to update status."},{status:500});} finally{client.release();}
}