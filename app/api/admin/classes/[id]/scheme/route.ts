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
    return NextResponse.json({ error: "No scheme of studies uploaded for this class." }, { status: 404 });
  }

  const upstream = await fetch(row.scheme_of_studies_url);
  if (!upstream.ok) {
    return NextResponse.json({ error: "Could not retrieve file." }, { status: 502 });
  }

  const buffer = await upstream.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"scheme-of-studies.pdf\"",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
