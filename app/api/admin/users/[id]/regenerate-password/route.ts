import { NextRequest, NextResponse } from "next/server";
import { resetAccountToDefault } from "@/lib/passwordSession";
import { requireRole } from "@/lib/requireRole";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireRole("admin");
  if (response) return response;
  if (session!.role === "assistant") return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  const { id } = await params;

  const saved = await resetAccountToDefault("users", id);
  if (!saved) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, mustChangePassword: true });
}
