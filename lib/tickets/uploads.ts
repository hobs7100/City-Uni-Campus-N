import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import cloudinary from "@/lib/cloudinary";
import {
  maxTicketFileBytes,
  maxTicketFiles,
  TicketInputError,
} from "./types";

const supportedTypes = new Set(["application/pdf", "image/jpeg", "audio/mpeg", "video/mpeg"]);
const maxTicketRequestBytes = 5 * 1024 * 1024;

export interface UploadedTicketFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
  publicId: string;
  resourceType: "image" | "raw" | "video";
  version: number;
}

function matchesSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "audio/mpeg") {
    return bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  }
  if (mimeType === "video/mpeg") {
    return bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 &&
      (bytes[3] === 0xba || bytes[3] === 0xb3);
  }
  return false;
}

export function filesFromForm(form: FormData) {
  const entries = form.getAll("files");
  if (entries.some((entry) => !(entry instanceof File))) {
    throw new TicketInputError("Invalid file upload.");
  }
  const files = entries as File[];
  if (files.length > maxTicketFiles) throw new TicketInputError("Upload no more than two files at a time.");
  for (const file of files) {
    if (!file.size) throw new TicketInputError("Uploaded files cannot be empty.");
    if (file.size > maxTicketFileBytes) throw new TicketInputError("Each file must be 2 MB or smaller.");
    if (!supportedTypes.has(file.type)) throw new TicketInputError("Only PDF, JPG, and MPEG files are allowed.");
  }
  return files;
}

export async function formDataFromBoundedRequest(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxTicketRequestBytes) {
    throw new TicketInputError("The complete upload request must be 5 MB or smaller.");
  }
  if (!request.body) throw new TicketInputError("A multipart request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxTicketRequestBytes) {
        await reader.cancel();
        throw new TicketInputError("The complete upload request must be 5 MB or smaller.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new TicketInputError("A valid multipart form-data request is required.");
  }
}

export async function uploadTicketFiles(files: File[], folder = "tickets") {
  const uploaded: UploadedTicketFile[] = [];
  try {
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!matchesSignature(bytes, file.type)) {
        throw new TicketInputError("The file content does not match its supported file type.");
      }
      const base64 = `data:${file.type};base64,${bytes.toString("base64")}`;
      const resourceType: UploadedTicketFile["resourceType"] =
        file.type === "image/jpeg" ? "image"
          : file.type === "application/pdf" ? "raw" : "video";
      const extension = file.type === "application/pdf" ? ".pdf" : "";
      const publicId = `campus-management/${folder}/${randomUUID()}${extension}`;
      const result = await cloudinary.uploader.upload(base64, {
        public_id: publicId,
        resource_type: resourceType,
        type: "authenticated",
        overwrite: false,
      });
      uploaded.push({
        name: file.name.replace(/[\\/\0]/g, "_").slice(0, 255) || "attachment",
        mimeType: file.type,
        sizeBytes: file.size,
        publicId: result.public_id,
        resourceType,
        version: result.version,
      });
    }
    return uploaded;
  } catch (error) {
    await deleteUploadedTicketFiles(uploaded);
    throw error;
  }
}

export async function deleteUploadedTicketFiles(files: UploadedTicketFile[]) {
  await Promise.allSettled(files.map((file) =>
    cloudinary.uploader.destroy(file.publicId, {
      resource_type: file.resourceType,
      type: "authenticated",
    }),
  ));
}

export function ticketAttachmentDownloadUrl(id: string) {
  return `/api/ticket-attachments/${encodeURIComponent(id)}`;
}

export function signedTicketAssetUrl(input: {
  publicId: string;
  resourceType: UploadedTicketFile["resourceType"];
  version: number;
  mimeType: string;
}) {
  return cloudinary.url(input.publicId, {
    resource_type: input.resourceType,
    type: "authenticated",
    version: input.version,
    secure: true,
    sign_url: true,
    ...(input.mimeType === "audio/mpeg" ? { format: "mp3" } : {}),
    ...(input.mimeType === "video/mpeg" ? { format: "mpeg" } : {}),
  });
}