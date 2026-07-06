import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.file || !body?.folder) {
    return NextResponse.json({ error: "Missing file or folder." }, { status: 400 });
  }

  try {
    const result = await uploadToCloudinary(body.file, body.folder);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
