import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/requireRole";
import { analyticsFilterOptions, dates, effective, resultRows, uuid, validDateRange } from "../_lib";
import { studentResults } from "../_students";

const percentageParam = (fallback: number) => z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? Number.NaN : value,
  z.coerce.number().min(0).max(100).default(fallback),
);
const schema = z.object({
  from_date: z.string().date().optional(), to_date: z.string().date().optional(),
  class_id: uuid.optional(), semester_id: uuid.optional(), course_id: uuid.optional(),
  test_series_id: uuid.optional(), session: z.string().min(1).optional(),
  min_percentage: percentageParam(0),
  max_percentage: percentageParam(100),
});

export async function GET(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const p = parsed.data;
  const window = dates(p.from_date, p.to_date);
  if (!validDateRange(window.from, window.to)) {
    return NextResponse.json({ error: "From date must not be after To date." }, { status: 400 });
  }
  if (p.min_percentage > p.max_percentage) {
    return NextResponse.json({ error: "Minimum percentage must not exceed maximum percentage." }, { status: 400 });
  }
  const rows = await resultRows({
    ...window, classId: p.class_id, semesterId: p.semester_id, courseId: p.course_id,
    testSeriesId: p.test_series_id, session: p.session,
  });
  const students = studentResults(rows).filter((row) => row.percentage >= p.min_percentage && row.percentage <= p.max_percentage);
  return NextResponse.json({
    students, filter_options: await analyticsFilterOptions(),
    effective_filters: { ...effective(raw, window.from, window.to), session: p.session ?? null,
      min_percentage: p.min_percentage, max_percentage: p.max_percentage },
  });
}
