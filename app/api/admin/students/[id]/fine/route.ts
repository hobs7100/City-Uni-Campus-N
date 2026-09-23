import { NextResponse } from "next/server";
import { getCurrentAttendanceFine, wasLastStruckOffFromTeacher } from "@/lib/attendance-fines";
import { requirePortalPermission } from "@/lib/portalPermissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requirePortalPermission(
    "students",
    "edit",
    "admin",
    "hod",
    "coordinator",
  );
  if (response) return response;

  const { id } = await params;
  const fine = await getCurrentAttendanceFine(id);
  if (!fine && await wasLastStruckOffFromTeacher(id)) {
    return NextResponse.json({ attendance_fine: null, no_fine_reactivation: true });
  }
  if (!fine || fine.status !== "struck_off") {
    return NextResponse.json(
      { error: "No current reactivation fine was found for this student." },
      { status: 404 },
    );
  }

  return NextResponse.json({ attendance_fine: fine });
}