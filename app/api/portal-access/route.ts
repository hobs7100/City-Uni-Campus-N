import { NextRequest, NextResponse } from "next/server";
import { getPortalAccess } from "@/lib/portalPermissions";
import { isPortalModule } from "@/lib/portalPermissionsConfig";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const { session, response } = await requireRole(
    "admin",
    "hod",
    "coordinator",
    "teacher",
    "student",
    "finance_manager",
    "assistant",
  );
  if (response || !session) return response;

  const moduleKey = request.nextUrl.searchParams.get("module");
  if (!moduleKey || !isPortalModule(moduleKey)) {
    return NextResponse.json({ error: "Invalid module." }, { status: 400 });
  }

  const access = await getPortalAccess(session.role, moduleKey);
  return NextResponse.json(access);
}