import { NextRequest, NextResponse } from "next/server";
import { getClient, query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { feedbackSchema } from "@/lib/feedback";

export async function GET() {
  const { session, response } = await requireRole("student"); if (response) return response;
  const rows = await query(`select id, category, other_issue, body, status, created_at, updated_at from feedback where student_id=$1 order by created_at desc`, [session!.userId]);
  return NextResponse.json(rows);
}
export async function POST(request: NextRequest) {
  const { session, response } = await requireRole("student"); if (response) return response;
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const client = await getClient();
  try {
    await client.query("begin");
    const r = await client.query(`insert into feedback(student_id,category,other_issue,body) values($1,$2,$3,$4) returning id`, [session!.userId, parsed.data.category, parsed.data.other_issue ?? null, parsed.data.body]);
    for (const a of parsed.data.attachments) await client.query(`insert into feedback_attachments(feedback_id,url,public_id) values($1,$2,$3)`, [r.rows[0].id, a.url, a.public_id]);
    await client.query(`insert into feedback_status_history(feedback_id,status,changed_by) values($1,'submitted',$2)`, [r.rows[0].id, session!.userId]);
    await client.query("commit"); return NextResponse.json({ id: r.rows[0].id }, { status: 201 });
  } catch { await client.query("rollback"); return NextResponse.json({ error: "Unable to create feedback." }, { status: 500 }); } finally { client.release(); }
}