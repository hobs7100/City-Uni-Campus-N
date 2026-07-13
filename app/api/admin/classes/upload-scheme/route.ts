import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { uploadRawToCloudinary } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!body?.fileBase64 || typeof body.fileBase64 !== "string") {
    return NextResponse.json({ error: "fileBase64 is required." }, { status: 400 });
  }

  const { url } = await uploadRawToCloudinary(body.fileBase64, "scheme-of-studies");
  return NextResponse.json({ url });
}
