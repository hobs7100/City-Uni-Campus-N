import { NextRequest, NextResponse } from "next/server";
import { resetAccountToDefault } from "@/lib/passwordSession";
import { requirePortalPermission } from "@/lib/portalPermissions";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePortalPermission("teachers", "edit", "admin");
  if (response) return response;
  const { id } = await params;

  const saved = await resetAccountToDefault("teachers", id);
  if (!saved) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  return NextResponse.json({ success: true, mustChangePassword: true });
}
