import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";

/** Read-only catalogue. Test series are shared DIT assessment definitions. */
export async function GET() {
  const { response } = await requireRole("teacher");
  if (response) return response;

  const series = await query(
    `select id, name, total_marks, passing_marks
     from dit_test_series
     order by created_at desc, name asc`
  );
  return NextResponse.json({ series });
}