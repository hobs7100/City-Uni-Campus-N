import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireExactRole } from "@/lib/requireRole";
import { announceDitMidResult, MidResultAnnouncementError } from "@/lib/dit-mid-result-announcement";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireExactRole("admin");
  if (response) return response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid test series." }, { status: 400 });
  }
  try {
    const client = await pool.connect();
    try {
      const announcement = await announceDitMidResult(client, id, session!.userId);
      return NextResponse.json({ announcement }, { headers: { "Cache-Control": "no-store" } });
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof MidResultAnnouncementError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("DIT Mid-Term announcement failed:", error);
    return NextResponse.json({ error: "Unable to announce Mid-Term results." }, { status: 500 });
  }
}
