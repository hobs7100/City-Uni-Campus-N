import { NextResponse } from "next/server";
import { requireActiveStudent } from "@/lib/requireActiveStudent";
import { getStudentExamSlip } from "@/lib/student-exam-slip";

export async function GET() {
  const { session, response } = await requireActiveStudent();
  if (response) return response;
  const data = await getStudentExamSlip(session!.userId, "clearance");
  return data ? NextResponse.json(data) : NextResponse.json({ error: "Student not found." }, { status: 404 });
}
