import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requirePortalPermission } from "@/lib/portalPermissions";
import { semesterBounds } from "@/lib/classSemester";

const typeToSemesters: Record<string, number> = { ADP: 4, DIT: 4, BS: 8, LLB: 8, "BS-Bridging": 4 };

const schema = z.object({
  department_id: z.string().uuid().optional(),
  class_name: z.string().min(1).optional(),
  session: z.string().min(4).optional(),
  affiliation_id: z.string().uuid().nullable().optional(),
  type: z.enum(["ADP", "BS", "DIT", "LLB", "BS-Bridging"]).optional(),
  starting_semester: z.number().int().optional(),
  status: z.enum(["active", "blocked"]).optional(),
  scheme_of_studies_url: z.string().url().nullable().optional(),
  scheme_public_id: z.string().nullable().optional(),
  scheme_resource_type: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePortalPermission("classes", "edit", "admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const current = await queryOne<{ class_name: string; type: string; starting_semester: number }>(
    `select class_name, type::text, starting_semester from classes where id = $1`,
    [id],
  );
  if (!current) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const d = parsed.data;
  const effectiveName = d.class_name ?? current.class_name;
  const normalizedType = /bridging/i.test(effectiveName) ? "BS-Bridging" : (d.type ?? current.type);
  const { minimum, maximum } = semesterBounds(normalizedType, typeToSemesters[normalizedType]);
  const startingSemester = d.starting_semester ?? current.starting_semester;
  if (startingSemester < minimum || startingSemester > maximum) {
    return NextResponse.json({ error: `Starting semester must be between ${minimum} and ${maximum}.` }, { status: 400 });
  }
  const firstRecorded = await queryOne<{ first_semester: number | null; last_semester: number | null }>(
    `select min(semester_number)::int as first_semester, max(semester_number)::int as last_semester from semesters where class_id = $1`,
    [id],
  );
  if (firstRecorded?.first_semester != null && (startingSemester > firstRecorded.first_semester || firstRecorded.first_semester < minimum || firstRecorded.last_semester! > maximum)) {
    return NextResponse.json({ error: "Starting semester and class type must preserve the existing semester history." }, { status: 409 });
  }
  const normalizedData = { ...d, type: normalizedType as NonNullable<typeof d.type> };

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(normalizedData)) {
    sets.push(`${key} = $${i++}`);
    values.push(value === undefined ? null : value);
  }
  sets.push(`total_semesters = $${i++}`);
  values.push(typeToSemesters[normalizedType]);
  sets.push("updated_at = now()");
  values.push(id);

  const updated = await queryOne(`update classes set ${sets.join(", ")} where id = $${i} returning *`, values);
  if (!updated) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  return NextResponse.json({ class: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePortalPermission("classes", "delete", "admin");
  if (response) return response;
  const { id } = await params;

  const used = await queryOne(`select id from students where class_id = $1 limit 1`, [id]);
  if (used) {
    return NextResponse.json({ error: "This class has students enrolled and cannot be deleted." }, { status: 409 });
  }

  await query(`delete from classes where id = $1`, [id]);
  return NextResponse.json({ success: true });
}
