import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import cloudinary from "@/lib/cloudinary";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole("admin", "coordinator", "hod", "student");
  if (response) return response;

  const { id } = await params;
  const row = await queryOne<{
    scheme_of_studies_url: string | null;
    scheme_public_id: string | null;
    scheme_resource_type: string | null;
  }>(
    `select scheme_of_studies_url, scheme_public_id, scheme_resource_type
     from classes where id = $1`,
    [id]
  );

  if (!row?.scheme_of_studies_url) {
    return NextResponse.json(
      { error: "No scheme of studies uploaded for this class." },
      { status: 404 }
    );
  }

  const publicId = row.scheme_public_id;
  const resourceType = (row.scheme_resource_type ?? "image") as "image" | "raw" | "video";

  if (publicId) {
    // Generate a time-limited signed download URL via the SDK.
    // fl_attachment forces the browser to download the file (Content-Disposition: attachment)
    // with Content-Type: application/pdf. This works for both public and
    // authenticated Cloudinary resources.
    const downloadUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      format: "pdf",
      flags: "attachment:scheme-of-studies.pdf",
      sign_url: true,
      secure: true,
      type: "upload",
    });
    return NextResponse.redirect(downloadUrl, { status: 302 });
  }

  // Fallback for older rows that only have the raw URL stored.
  // Try to parse the public_id from the URL and generate a signed URL.
  const m = row.scheme_of_studies_url.match(
    /res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/
  );
  if (m) {
    const rt = m[1] as "image" | "raw" | "video";
    let path = m[2];
    let fmt = "pdf";
    if (rt !== "raw") {
      const dot = path.lastIndexOf(".");
      if (dot !== -1) { fmt = path.slice(dot + 1); path = path.slice(0, dot); }
    }
    const downloadUrl = cloudinary.url(path, {
      resource_type: rt,
      format: fmt,
      flags: "attachment:scheme-of-studies.pdf",
      sign_url: true,
      secure: true,
      type: "upload",
    });
    return NextResponse.redirect(downloadUrl, { status: 302 });
  }

  // Last resort: redirect to the raw stored URL.
  return NextResponse.redirect(row.scheme_of_studies_url, { status: 302 });
}
