import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getSession } from "@/lib/session";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_SIZE_LABEL } from "@/lib/upload-limits";

const limitedFolders = new Set(["students", "leave-proofs"]);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.file || !body?.folder) {
    return NextResponse.json({ error: "Missing file or folder." }, { status: 400 });
  }

  if (limitedFolders.has(body.folder)) {
    if (typeof body.file !== "string" || !body.file.includes(",")) {
      return NextResponse.json({ error: "Invalid file data." }, { status: 400 });
    }

    const base64 = body.file.slice(body.file.indexOf(",") + 1);
    const fileSize = Buffer.from(base64, "base64").length;
    if (fileSize === 0 || fileSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Files must be ${MAX_UPLOAD_SIZE_LABEL} or smaller.` },
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
