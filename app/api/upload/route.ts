import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getSession } from "@/lib/session";
import { getPortalAccess } from "@/lib/portalPermissions";
import { isPortalManagedRole, type PortalModule } from "@/lib/portalPermissionsConfig";
import {
  MAX_PROFILE_IMAGE_BYTES,
  MAX_PROFILE_IMAGE_SIZE_LABEL,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SIZE_LABEL,
} from "@/lib/upload-limits";

const limitedFolders = new Set(["students", "leave-proofs", "feedback"]);
const folderModules: Record<string, PortalModule> = {
  students: "students",
  "leave-proofs": "leave_management",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.file || !body?.folder) {
    return NextResponse.json({ error: "Missing file or folder." }, { status: 400 });
  }
  if (typeof body.folder !== "string" || !limitedFolders.has(body.folder)) {
    return NextResponse.json({ error: "Unsupported upload folder." }, { status: 400 });
  }
  if (body.folder === "feedback") {
    if (session.role !== "student") return NextResponse.json({ error: "Only students may upload feedback attachments." }, { status: 403 });
    if (typeof body.file !== "string" || !/^data:image\/(png|jpeg);base64,/i.test(body.file)) {
      return NextResponse.json({ error: "Only PNG or JPEG images are accepted." }, { status: 400 });
    }
    const base64 = body.file.slice(body.file.indexOf(",") + 1);
    const bytes = Buffer.from(base64, "base64");
    const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255,216,255]));
    if ((!png && !jpeg) || bytes.length === 0 || bytes.length > 500 * 1024) {
      return NextResponse.json({ error: "PNG/JPEG files must decode to 500 KB or smaller." }, { status: 413 });
    }
  }
  if (isPortalManagedRole(session.role)) {
    const access = await getPortalAccess(session.role, folderModules[body.folder]);
    if (!access.canView || !access.canEdit) {
      return NextResponse.json(
        { error: "Editing is locked by Portal Management." },
        { status: 403 },
      );
    }
  }

  if (limitedFolders.has(body.folder)) {
    if (typeof body.file !== "string" || !body.file.includes(",")) {
      return NextResponse.json({ error: "Invalid file data." }, { status: 400 });
    }

    const base64 = body.file.slice(body.file.indexOf(",") + 1);
    const fileSize = Buffer.from(base64, "base64").length;
    const maxBytes = body.folder === "students" ? MAX_PROFILE_IMAGE_BYTES : MAX_UPLOAD_BYTES;
    const maxSizeLabel =
      body.folder === "students" ? MAX_PROFILE_IMAGE_SIZE_LABEL : MAX_UPLOAD_SIZE_LABEL;
    if (fileSize === 0 || fileSize > maxBytes) {
      return NextResponse.json(
        { error: `Files must be ${maxSizeLabel} or smaller.` },
        { status: 413 },
      );
    }
  }

  try {
    const result = await uploadToCloudinary(body.file, body.folder);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
