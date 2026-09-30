import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isTicketUuid, requireTicketScope } from "@/lib/tickets/service";
import { signedTicketAssetUrl } from "@/lib/tickets/uploads";
import { maxTicketFileBytes, ticketEmployeeRoles, type TicketEmployeeRole } from "@/lib/tickets/types";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const initialSession = await getSession();
  if (!initialSession.isLoggedIn) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  const role = initialSession.role as string;
  const scope = role === "admin"
    ? "admin"
    : role === "student"
      ? "student"
      : ticketEmployeeRoles.includes(role as TicketEmployeeRole) ? "employee" : null;
  if (!scope) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  const { session, response } = await requireTicketScope(scope);
  if (response) return response;
  const { id } = await params;
  if (!isTicketUuid(id)) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  const attachment = await queryOne<{
    public_id: string;
    resource_type: "image" | "raw" | "video";
    asset_version: number;
    mime_type: string;
    name: string;
    size_bytes: number;
    student_id: string;
    assigned_user_id: string | null;
  }>(
    `select a.public_id, a.resource_type, a.asset_version, a.mime_type,
            a.name, a.size_bytes, t.student_id, t.assigned_user_id
     from ticket_attachments a
     join tickets t on t.id = a.ticket_id
     where a.id = $1`,
    [id],
  );
  if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  const allowed = role === "admin" ||
    (role === "student" && attachment.student_id === session!.userId) ||
    (ticketEmployeeRoles.includes(role as TicketEmployeeRole) &&
      attachment.assigned_user_id === session!.userId);
  if (!allowed) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  try {
    const url = signedTicketAssetUrl({
      publicId: attachment.public_id,
      resourceType: attachment.resource_type,
      version: attachment.asset_version,
      mimeType: attachment.mime_type,
    });
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      return NextResponse.json({ error: "Attachment is unavailable." }, { status: 502 });
    }
    const contentLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxTicketFileBytes) {
      await upstream.body.cancel();
      return NextResponse.json({ error: "Attachment exceeds the allowed size." }, { status: 502 });
    }
    const body = limitStream(upstream.body, maxTicketFileBytes);
    return new Response(body, {
      headers: {
        "Content-Type": attachment.mime_type,
        "Content-Disposition": attachmentDisposition(attachment.name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment is unavailable." }, { status: 500 });
  }
}

function attachmentDisposition(name: string) {
  const safeName = name.replace(/[\\/\r\n"]/g, "_").slice(0, 255) || "attachment";
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, "_");
  const encodedName = encodeURIComponent(safeName).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

function limitStream(stream: ReadableStream<Uint8Array>, maximumBytes: number) {
  const reader = stream.getReader();
  let sentBytes = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        sentBytes += value.byteLength;
        if (sentBytes > maximumBytes) {
          await reader.cancel();
          controller.error(new Error("Attachment exceeds the allowed size."));
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}