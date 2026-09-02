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
  );
  if (response || !session) return response;

  const module = request.nextUrl.searchParams.get("module");
  if (!module || !isPortalModule(module)) {
    return NextResponse.json({ error: "Invalid module." }, { status: 400 });
  }

  const access = await getPortalAccess(session.role, module);
  return NextResponse.json(access);
}