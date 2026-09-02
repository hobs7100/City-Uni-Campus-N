import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/requireRole";
import { deleteRawFromCloudinary, uploadRawToCloudinary } from "@/lib/cloudinary";

const allowedTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);
const allowedExtensions = new Set(["png", "jpg", "jpeg", "pdf"]);
const maxFileSize = 10 * 1024 * 1024;

async function isAllowedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const type = file.type.toLowerCase();
  const metadataIsValid =
    allowedTypes.has(type) &&
    !!extension &&
    allowedExtensions.has(extension) &&
    file.size > 0 &&
    file.size <= maxFileSize;
  if (!metadataIsValid) return false;

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (type === "image/png") {
    return (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    );
  }
  if (type === "image/jpeg") {
    return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  return new TextDecoder().decode(header.slice(0, 5)) === "%PDF-";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const course = await queryOne<{ course_outline_public_id: string | null }>(
    `select course_outline_public_id from courses where id = $1`,
    [id],
  );
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No outline file provided." }, { status: 400 });
  }
  if (!(await isAllowedFile(file))) {
    return NextResponse.json(
      { error: "Only PNG, JPG, and PDF files up to 10 MB are allowed." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    const uploaded = await uploadRawToCloudinary(base64, "course-outlines");

    await query(
      `update courses
       set course_outline_url = $1, course_outline_public_id = $2, updated_at = now()
       where id = $3`,
      [uploaded.url, uploaded.publicId, id],
    );

    if (course.course_outline_public_id) {
      await deleteRawFromCloudinary(course.course_outline_public_id).catch(() => {});
    }

    return NextResponse.json({ url: uploaded.url });
  } catch (error) {
    console.error("Course outline upload failed:", error);
    return NextResponse.json({ error: "Course outline upload failed." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;
  const { id } = await params;

  const course = await queryOne<{ course_outline_public_id: string | null }>(
    `select course_outline_public_id from courses where id = $1`,
    [id],
  );
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  if (course.course_outline_public_id) {
    await deleteRawFromCloudinary(course.course_outline_public_id).catch(() => {});
  }

  await query(
    `update courses
     set course_outline_url = null, course_outline_public_id = null, updated_at = now()
     where id = $1`,
    [id],
  );
  return NextResponse.json({ success: true });
}