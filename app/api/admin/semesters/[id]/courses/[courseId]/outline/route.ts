import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> }
) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id, courseId } = await params;

  const sc = await queryOne<{
    semester_id: string;
    course_id: string;
    course_outline_public_id: string | null;
  }>(
    `select semester_id, course_id, course_outline_public_id
     from semester_courses where semester_id = $1 and course_id = $2`,
    [id, courseId]
  );
  if (!sc) return NextResponse.json({ error: "Course not in this semester." }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  // Delete old outline if exists
  if (sc.course_outline_public_id) {
    await deleteFromCloudinary(sc.course_outline_public_id).catch(() => {});
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type || "application/octet-stream"};base64,${buf.toString("base64")}`;
  const { url, publicId } = await uploadToCloudinary(base64, "course-outlines");

  await query(
    `update semester_courses set course_outline_url = $1, course_outline_public_id = $2
     where semester_id = $3 and course_id = $4`,
    [url, publicId, id, courseId]
  );

  return NextResponse.json({ url });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> }
) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id, courseId } = await params;

  const sc = await queryOne<{ course_outline_public_id: string | null }>(
    `select course_outline_public_id from semester_courses where semester_id = $1 and course_id = $2`,
    [id, courseId]
  );
  if (!sc) return NextResponse.json({ error: "Course not in this semester." }, { status: 404 });

  if (sc.course_outline_public_id) {
    await deleteFromCloudinary(sc.course_outline_public_id).catch(() => {});
  }

  await query(
    `update semester_courses set course_outline_url = null, course_outline_public_id = null
     where semester_id = $1 and course_id = $2`,
    [id, courseId]
  );

  return NextResponse.json({ success: true });
}
