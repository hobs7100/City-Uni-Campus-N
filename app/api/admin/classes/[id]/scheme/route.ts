import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

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

  // Redirect the browser directly to the Cloudinary URL that was stored
  // at upload time. This URL already contains the correct version,
  // resource type, and .pdf extension so Cloudinary serves it with
  // Content-Type: application/pdf.
  return NextResponse.redirect(row.scheme_of_studies_url, { status: 302 });
}
