import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getClient, query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  ticketEmployeeRoles,
  ticketStatusSchema,
  validateTicketDescription,
  type TicketStatus,
  type TicketEmployeeRole,
  TicketInputError,
} from "./types";
import {
  deleteUploadedTicketFiles,
  formDataFromBoundedRequest,
  filesFromForm,
  uploadTicketFiles,
  type UploadedTicketFile,
} from "./uploads";

export type TicketScope = "admin" | "student" | "employee";
export type TicketActorType = TicketScope;

export async function requireTicketScope(scope: TicketScope) {
  const session = await getSession();
  const role = session.role as string;
  const allowed = scope === "admin"
    ? role === "admin"
    : scope === "student"
      ? role === "student"
      : ticketEmployeeRoles.includes(role as TicketEmployeeRole);
  if (!session.isLoggedIn || !allowed) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 403 }),
    };
  }
  const activeRecord = scope === "student"
    ? await queryOne<{ id: string }>(
        "select id from students where id = $1 and deleted_at is null",
        [session.userId],
      )
    : await queryOne<{ id: string }>(
        `select id from users
         where id = $1 and role::text = $2 and status = 'active' and deleted_at is null`,
        [session.userId, role],
      );
  if (!activeRecord) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 403 }),
    };
  }
  return { session, response: null };
}

export function isTicketUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function readTicket(id: string) {
  if (!isTicketUuid(id)) return null;
  const ticket = await queryOne<{
    id: string;
    category_id: string;
    category_title: string;
    status: TicketStatus;
    description: string;
    created_at: string;
    updated_at: string;
    student_id: string;
    student_name: string;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
  }>(
    `select t.id, t.category_id, tc.title as category_title, t.status,
            t.description, t.created_at, t.updated_at, t.student_id,
            s.name as student_name, t.assigned_user_id,
            u.name as assigned_user_name
     from tickets t
     join ticket_categories tc on tc.id = t.category_id
     join students s on s.id = t.student_id
     left join users u on u.id = t.assigned_user_id
     where t.id = $1`,
    [id],
  );
  if (!ticket) return null;
  const events = await query<{
    id: string;
    event_type: string;
    actor_name: string | null;
    actor_role: string;
    status: TicketStatus;
    remark: string | null;
    created_at: string;
    document_request_id: string | null;
    document_request_status: "pending" | "fulfilled" | null;
  }>(
    `select e.id, e.event_type,
            case when e.actor_type = 'student'
              then (select s.name from students s where s.id = e.actor_id)
              else (select u.name from users u where u.id = e.actor_id)
            end as actor_name,
            e.actor_role, e.status_snapshot as status, e.remark, e.created_at,
            dr.id as document_request_id,
            case when e.event_type = 'document_requested'
              then case when dr.fulfilled_event_id is null then 'pending' else 'fulfilled' end
              when e.event_type = 'document_uploaded' and dr.id is not null then 'fulfilled'
              else null
            end as document_request_status
     from ticket_events e
     left join ticket_document_requests dr
       on dr.requested_event_id = e.id or dr.fulfilled_event_id = e.id
     where e.ticket_id = $1
     order by e.created_at, e.id`,
    [id],
  );
  const attachments = events.length
    ? await query<{
        id: string;
        event_id: string;
        name: string;
        mime_type: string;
        size_bytes: number;
      }>(
        `select id, event_id, name, mime_type, size_bytes
         from ticket_attachments
         where event_id = any($1::uuid[])
         order by created_at, id`,
        [events.map((event) => event.id)],
      )
    : [];
  const attachmentsByEvent = new Map<string, typeof attachments>();
  for (const attachment of attachments) {
    const list = attachmentsByEvent.get(attachment.event_id) ?? [];
    list.push(attachment);
    attachmentsByEvent.set(attachment.event_id, list);
  }
  const history = events.map((event) => ({
    ...event,
    attachments: (attachmentsByEvent.get(event.id) ?? []).map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
      download_url: `/api/ticket-attachments/${encodeURIComponent(attachment.id)}`,
    })),
  }));
  return { ticket, history };
}

export async function listTickets(scope: TicketScope, actorId: string) {
  const where = scope === "student"
    ? "where t.student_id = $1"
    : scope === "employee"
      ? "where t.assigned_user_id = $1"
      : "";
  const rows = await query<{
    id: string;
    category_id: string;
    category_title: string;
    status: TicketStatus;
    description: string;
    created_at: string;
    updated_at: string;
    student_id: string;
    student_name: string;
    assigned_user_id: string | null;
    assigned_user_name: string | null;
  }>(
    `select t.id, t.category_id, tc.title as category_title, t.status,
            t.description, t.created_at, t.updated_at, t.student_id,
            s.name as student_name, t.assigned_user_id,
            u.name as assigned_user_name
     from tickets t
     join ticket_categories tc on tc.id = t.category_id
     join students s on s.id = t.student_id
     left join users u on u.id = t.assigned_user_id
     ${where}
     order by t.updated_at desc, t.created_at desc`,
    scope === "admin" ? [] : [actorId],
  );
  return rows;
}

export async function addTicketEvent(
  client: PoolClient,
  input: {
    ticketId: string;
    eventType: string;
    actorType: TicketActorType;
    actorId: string;
    actorRole: string;
    status: TicketStatus;
    remark?: string | null;
  },
) {
  const result = await client.query<{ id: string }>(
    `insert into ticket_events
       (ticket_id, event_type, actor_type, actor_id, actor_role, status_snapshot, remark)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning id`,
    [
      input.ticketId,
      input.eventType,
      input.actorType,
      input.actorId,
      input.actorRole,
      input.status,
      input.remark || null,
    ],
  );
  return result.rows[0].id;
}

export async function saveTicketAttachments(
  client: PoolClient,
  ticketId: string,
  eventId: string,
  files: UploadedTicketFile[],
  requestId?: string | null,
) {
  for (const file of files) {
    await client.query(
      `insert into ticket_attachments
         (ticket_id, event_id, request_id, name, mime_type, size_bytes, resource_type, asset_version, public_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        ticketId,
        eventId,
        requestId || null,
        file.name,
        file.mimeType,
        file.sizeBytes,
        file.resourceType,
        file.version,
        file.publicId,
      ],
    );
  }
}

export async function cleanupTicketUploads(files: UploadedTicketFile[]) {
  await deleteUploadedTicketFiles(files);
}

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validRemark(value: string) {
  return value.length <= 5000 && value.split(/\s+/).filter(Boolean).length <= 1000;
}

export async function createStudentTicket(request: Request, studentId: string) {
  let form: FormData;
  let uploaded: UploadedTicketFile[] = [];
  let committed = false;
  try {
    try {
      form = await formDataFromBoundedRequest(request);
    } catch (error) {
      return {
        status: 400,
        body: { error: isTicketInputError(error) ? error.message : "A valid multipart ticket submission is required." },
      };
    }
    const categoryId = formText(form, "category_id");
    const description = formText(form, "description");
    if (!isTicketUuid(categoryId)) return { status: 400, body: { error: "Select a valid issue category." } };
    const descriptionError = validateTicketDescription(description);
    if (descriptionError) return { status: 400, body: { error: descriptionError } };
    const files = filesFromForm(form);
    const category = await queryOne<{ id: string }>(
      "select id from ticket_categories where id = $1 and active",
      [categoryId],
    );
    if (!category) return { status: 400, body: { error: "The selected issue category is unavailable." } };
    uploaded = await uploadTicketFiles(files);
    const client = await getClient();
    try {
      await client.query("begin");
      const activeCategory = await client.query(
        "select id from ticket_categories where id = $1 and active for share",
        [categoryId],
      );
      if (!activeCategory.rows[0]) {
        await client.query("rollback");
        await cleanupTicketUploads(uploaded);
        uploaded = [];
        return { status: 400, body: { error: "The selected issue category is unavailable." } };
      }
      const result = await client.query<{ id: string; status: TicketStatus }>(
        `insert into tickets(student_id,category_id,description)
         values ($1,$2,$3) returning id,status`,
        [studentId, categoryId, description],
      );
      const ticket = result.rows[0];
      const eventId = await addTicketEvent(client, {
        ticketId: ticket.id,
        eventType: "created",
        actorType: "student",
        actorId: studentId,
        actorRole: "student",
        status: ticket.status,
        remark: "Ticket submitted.",
      });
      await saveTicketAttachments(client, ticket.id, eventId, uploaded);
      await client.query("commit");
      committed = true;
      return { status: 201, body: { id: ticket.id } };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (!committed && uploaded.length) await cleanupTicketUploads(uploaded);
    if (isTicketInputError(error)) return { status: 400, body: { error: error.message } };
    console.error("Ticket creation failed:", error);
    return { status: 500, body: { error: "Unable to submit the ticket." } };
  }
}

export async function handleTicketAction(
  request: Request,
  ticketId: string,
  scope: TicketScope,
  actorId: string,
  actorRole: string,
) {
  let uploaded: UploadedTicketFile[] = [];
  let client: Awaited<ReturnType<typeof getClient>> | null = null;
  let transactionStarted = false;
  try {
    if (!isTicketUuid(ticketId)) return { status: 400, body: { error: "A valid ticket ID is required." } };
    let form: FormData;
    try {
      form = await formDataFromBoundedRequest(request);
    } catch (error) {
      return {
        status: 400,
        body: { error: isTicketInputError(error) ? error.message : "A valid multipart ticket action is required." },
      };
    }
    const action = formText(form, "action");
    const allowedActions = scope === "student"
      ? ["remark", "upload"]
      : ["remark", "status", "request_document", "upload", ...(scope === "admin" ? ["assign"] : [])];
    if (!allowedActions.includes(action)) {
      return { status: 400, body: { error: "Invalid ticket action." } };
    }
    const remark = formText(form, "remark");
    if (remark && !validRemark(remark)) {
      return { status: 400, body: { error: "Remarks must be 1000 words or fewer and no longer than 5000 characters." } };
    }
    if (action === "remark" && !remark) {
      return { status: 400, body: { error: "A remark is required." } };
    }
    if (action === "request_document" && !remark) {
      return { status: 400, body: { error: "Describe which documents are required." } };
    }
    const requestId = formText(form, "request_id");
    if (requestId && !isTicketUuid(requestId)) {
      return { status: 400, body: { error: "A valid document request ID is required." } };
    }
    let files: File[] = [];
    if (action === "upload") {
      files = filesFromForm(form);
      if (files.length === 0) return { status: 400, body: { error: "Choose at least one file to upload." } };
      if (scope === "student" && !requestId) {
        return { status: 400, body: { error: "A document request is required to upload ticket documents." } };
      }
    } else if (form.getAll("files").length > 0) {
      return { status: 400, body: { error: "Files are accepted only with an upload action." } };
    }
    const nextStatus = action === "status" ? ticketStatusSchema.safeParse(formText(form, "status")) : null;
    if (action === "status" && !nextStatus?.success) {
      return { status: 400, body: { error: "Choose a valid ticket status." } };
    }
    const assigneeId = action === "assign" ? formText(form, "assignee_id") : "";
    if (action === "assign" && !isTicketUuid(assigneeId)) {
      return { status: 400, body: { error: "Select a valid employee." } };
    }

    client = await getClient();
    await client.query("begin");
    transactionStarted = true;
    const ticket = await authorizeTicketAction(client, ticketId, scope, actorId);
    if (!ticket) {
      await client.query("rollback");
      transactionStarted = false;
      return { status: 404, body: { error: "Ticket not found." } };
    }

    if (action === "remark") {
      await addTicketEvent(client, {
        ticketId, eventType: "remark", actorType: scope, actorId, actorRole,
        status: ticket.status, remark,
      });
    } else if (action === "assign") {
      const assigneeResult = await client.query<{ id: string; name: string }>(
        `select id,name from users
         where id = $1 and status = 'active' and deleted_at is null
           and role::text = any($2::text[])`,
        [assigneeId, ticketEmployeeRoles],
      );
      const assignee = assigneeResult.rows[0];
      if (!assignee) {
        await client.query("rollback");
        transactionStarted = false;
        return { status: 400, body: { error: "Choose an active Assistant, Controller, Suprident, or Accountant." } };
      }
      await client.query(
        "update tickets set assigned_user_id = $1, updated_at = now() where id = $2",
        [assignee.id, ticketId],
      );
      await addTicketEvent(client, {
        ticketId, eventType: "assigned", actorType: "admin", actorId, actorRole,
        status: ticket.status,
        remark: `Assigned to ${assignee.name}.${remark ? ` ${remark}` : ""}`,
      });
    } else if (action === "status") {
      const status = nextStatus!.data as TicketStatus;
      await client.query(
        "update tickets set status = $1, updated_at = now() where id = $2",
        [status, ticketId],
      );
      await addTicketEvent(client, {
        ticketId, eventType: "status", actorType: scope, actorId, actorRole,
        status, remark: remark || `Status changed to ${status.replace("_", " ")}.`,
      });
    } else if (action === "request_document") {
      const eventId = await addTicketEvent(client, {
        ticketId, eventType: "document_requested", actorType: scope, actorId, actorRole,
        status: ticket.status, remark,
      });
      await client.query(
        "insert into ticket_document_requests(ticket_id,requested_event_id) values($1,$2)",
        [ticketId, eventId],
      );
    } else if (action === "upload") {
      let validRequestId: string | null = null;
      if (requestId) {
        const requestResult = await client.query<{ id: string }>(
          `select id from ticket_document_requests
           where id = $1 and ticket_id = $2 and fulfilled_event_id is null
           for update`,
          [requestId, ticketId],
        );
        if (!requestResult.rows[0]) {
          await client.query("rollback");
          transactionStarted = false;
          return { status: 400, body: { error: "This document request is not open for uploads." } };
        }
        validRequestId = requestId;
      }
      uploaded = await uploadTicketFiles(files);
      const eventId = await addTicketEvent(client, {
        ticketId, eventType: "document_uploaded", actorType: scope, actorId, actorRole,
        status: ticket.status, remark: remark || (validRequestId ? "Requested documents uploaded." : "Documents uploaded."),
      });
      await saveTicketAttachments(client, ticketId, eventId, uploaded, validRequestId);
      if (validRequestId) {
        await client.query(
          `update ticket_document_requests
           set fulfilled_event_id = $1, fulfilled_at = now()
           where id = $2 and fulfilled_event_id is null`,
          [eventId, validRequestId],
        );
      }
    }
    await client.query("commit");
    transactionStarted = false;
    return { status: 201, body: { ok: true } };
  } catch (error) {
    if (transactionStarted && client) await client.query("rollback").catch(() => undefined);
    if (uploaded.length) await cleanupTicketUploads(uploaded);
    if (isTicketInputError(error)) return { status: 400, body: { error: error.message } };
    console.error("Ticket action failed:", error);
    return { status: 500, body: { error: "Unable to update the ticket." } };
  } finally {
    client?.release();
  }
}

export async function authorizeTicketAction(
  client: PoolClient,
  ticketId: string,
  scope: TicketScope,
  actorId: string,
) {
  const result = await client.query<{
    id: string;
    student_id: string;
    assigned_user_id: string | null;
    status: TicketStatus;
  }>(
    `select id, student_id, assigned_user_id, status
     from tickets where id = $1 for update`,
    [ticketId],
  );
  const ticket = result.rows[0];
  if (!ticket) return null;
  if (scope === "student" && ticket.student_id !== actorId) return null;
  if (scope === "employee" && ticket.assigned_user_id !== actorId) return null;
  return ticket;
}

export function isTicketInputError(error: unknown): error is TicketInputError {
  return error instanceof TicketInputError;
}