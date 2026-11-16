import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireExactRole } from "@/lib/requireRole";
import { setDitMidResultVisibility, MidResultAnnouncementError } from "@/lib/dit-mid-result-announcement";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireExactRole("admin");
  if (response) return response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid test series." }, { status: 400 });
  }
  // An empty body keeps the previous show-only endpoint compatible. Malformed
  // JSON or non-boolean states must never default into publishing results.
  const text = await request.text();
  let body: unknown;
  try { body = text.trim() ? JSON.parse(text) : {}; } catch {
    return NextResponse.json({ error: "Invalid visibility request." }, { status: 400 });
  }
  const parsed = z.object({ visible: z.boolean().default(true) }).strict().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Visible must be true or false." }, { status: 400 });
  }
  try {
    const client = await pool.connect();
    try {
      const announcement = await setDitMidResultVisibility(client, id, session!.userId, parsed.data.visible);
      return NextResponse.json({ announcement }, { headers: { "Cache-Control": "no-store" } });
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof MidResultAnnouncementError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("DIT Mid-Term visibility update failed:", error);
    return NextResponse.json({ error: "Unable to update Mid-Term result visibility." }, { status: 500 });
  }
}
