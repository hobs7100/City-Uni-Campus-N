import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import cloudinary from "@/lib/cloudinary";
import type { UploadApiResponse } from "cloudinary";

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.fileBase64 || typeof body.fileBase64 !== "string") {
    return NextResponse.json({ error: "fileBase64 is required." }, { status: 400 });
  }

  // Cloudinary raw resource_type does NOT support base64 data URIs —
  // it stores the literal encoded string instead of the decoded bytes,
  // producing a corrupted file. We decode server-side and upload the
  // actual PDF bytes via upload_stream instead.
  const match = body.fileBase64.match(/^data:[^;]+;base64,([\s\S]+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid file data (expected base64 data URI)." }, { status: 400 });
  }
  const buffer = Buffer.from(match[1], "base64");

  const uniqueId = `scheme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-management/scheme-of-studies",
        resource_type: "raw",
        public_id: `${uniqueId}.pdf`,  // .pdf kept in public_id for raw resources
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error("Upload failed."));
        } else {
          resolve(uploadResult);
        }
      }
    );
    stream.end(buffer);
  });

  return NextResponse.json({
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: "raw",
  });
}
