import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import cloudinary from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.fileBase64 || typeof body.fileBase64 !== "string") {
    return NextResponse.json({ error: "fileBase64 is required." }, { status: 400 });
  }

  // Upload as resource_type:"raw" with .pdf in the public_id.
  // Raw resources are served byte-for-byte; Cloudinary infers
  // Content-Type: application/pdf from the .pdf extension and delivers
  // the file correctly on all plans without any image transformation.
  const uniqueId = `scheme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await cloudinary.uploader.upload(body.fileBase64, {
    folder: "campus-management/scheme-of-studies",
    resource_type: "raw",
    public_id: `${uniqueId}.pdf`,   // extension kept for raw resources
  });

  return NextResponse.json({
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: "raw",
  });
}
