import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { commentSchema } from "@/lib/feedback";
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole("student"); if (response) return response;
  const { id } = await params;
  const f = await query(`select id,category,other_issue,body,status,created_at,updated_at from feedback where id=$1 and student_id=$2`, [id,session!.userId]);
  if (!f[0]) return NextResponse.json({ error:"Not found." }, { status:404 });
  const [attachments, comments, history] = await Promise.all([
    query(`select id,url,public_id,created_at from feedback_attachments where feedback_id=$1 order by created_at`,[id]),
    query(`select id,author_role,body,created_at from feedback_comments where feedback_id=$1 order by created_at`,[id]),
    query(`select id,status,created_at from feedback_status_history where feedback_id=$1 order by created_at`,[id]),
  ]);
  return NextResponse.json({ complaint:f[0], attachments, comments, status_history:history });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole("student"); if (response) return response;
  const { id } = await params; const parsed = commentSchema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400});
  const owns = await query(`select id from feedback where id=$1 and student_id=$2`,[id,session!.userId]);
  if (!owns[0]) return NextResponse.json({error:"Not found."},{status:404});
  await query(`insert into feedback_comments(feedback_id,author_id,author_role,body) values($1,$2,'student',$3)`,[id,session!.userId,parsed.data.body]);
  return NextResponse.json({ ok:true },{status:201});
}