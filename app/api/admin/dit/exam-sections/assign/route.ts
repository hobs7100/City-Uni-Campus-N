import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireExactRole } from "@/lib/requireRole";
import { assignDitExamSection, ExamSectionError } from "@/lib/dit-exam-sections";

const schema = z.object({
  student_ids: z.array(z.string().uuid()).min(1).max(1000),
  exam_section_id: z.string().uuid(),
});
export async function POST(req: NextRequest) {
  const { session, response } = await requireExactRole("admin");
  if (response) return response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an exam section and 1–1000 students." }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const changed = await assignDitExamSection(client, parsed.data.student_ids, parsed.data.exam_section_id, session!.userId);
    await client.query("commit");
    return NextResponse.json({ ok: true, changed });
  } catch (error) {
    await client.query("rollback");
    if (error instanceof ExamSectionError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("DIT exam section move failed", error);
    return NextResponse.json({ error: "No students were moved. Please try again." }, { status: 500 });
  } finally { client.release(); }
}
