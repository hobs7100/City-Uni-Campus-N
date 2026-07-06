import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

export async function GET(_request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const notifications = await query(
    `select * from notifications where recipient_type = 'student' and recipient_id = $1 order by created_at desc limit 100`,
    [session!.userId]
  );
  const unreadCount = notifications.filter((n) => !(n as { is_read: boolean }).is_read).length;

  return NextResponse.json({ notifications, unread_count: unreadCount });
}

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  mark_all: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireRole("student");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  if (parsed.data.mark_all) {
    await query(`update notifications set is_read = true where recipient_type = 'student' and recipient_id = $1`, [session!.userId]);
    return NextResponse.json({ success: true });
  }

  if (parsed.data.id) {
    const existing = await queryOne(
      `select id from notifications where id = $1 and recipient_type = 'student' and recipient_id = $2`,
      [parsed.data.id, session!.userId]
    );
    if (!existing) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    await query(`update notifications set is_read = true where id = $1`, [parsed.data.id]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id or mark_all is required." }, { status: 400 });
}
