import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import cloudinary from "@/lib/cloudinary";

/**
 * Parse a Cloudinary secure_url back into the parts needed to regenerate a
 * fresh signed delivery URL.
 *
 * Handles:
 *   image  – https://res.cloudinary.com/{cloud}/image/upload/v…/{path}.pdf
 *   raw    – https://res.cloudinary.com/{cloud}/raw/upload/v…/{path}
 */
function parseCloudinaryUrl(
  url: string
): { resourceType: "image" | "raw" | "video"; publicId: string; format: string } | null {
  const m = url.match(
    /res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/
  );
  if (!m) return null;

  const resourceType = m[1] as "image" | "raw" | "video";
  let path = m[2];
  let format = "";

  // For image/video resources Cloudinary appends the format as a file extension.
  // Strip it so public_id matches what the SDK expects.
  if (resourceType !== "raw") {
    const dot = path.lastIndexOf(".");
    if (dot !== -1) {
      format = path.slice(dot + 1);
      path = path.slice(0, dot);
    }
  }

  return { resourceType, publicId: path, format };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole("admin", "coordinator", "hod", "student");
  if (response) return response;

  const { id } = await params;
  const row = await queryOne<{ scheme_of_studies_url: string | null }>(
    `select scheme_of_studies_url from classes where id = $1`,
    [id]
  );

  if (!row?.scheme_of_studies_url) {
    return NextResponse.json(
      { error: "No scheme of studies uploaded for this class." },
      { status: 404 }
    );
  }

  const stored = row.scheme_of_studies_url;
  const parsed = parseCloudinaryUrl(stored);

  if (parsed) {
    // Generate a fresh signed URL via the SDK — works whether the resource is
    // public or authenticated, and guarantees the correct Content-Type header
    // is honoured by Cloudinary's CDN.
    const signedUrl = cloudinary.url(parsed.publicId, {
      resource_type: parsed.resourceType,
      format: parsed.format || "pdf",
      sign_url: true,
      secure: true,
      type: "upload",
    });
    return NextResponse.redirect(signedUrl, { status: 302 });
  }

  // Fallback: redirect straight to whatever URL is stored.
  return NextResponse.redirect(stored, { status: 302 });
}
