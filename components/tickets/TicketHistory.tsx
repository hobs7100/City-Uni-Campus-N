"use client";

import { FileText } from "lucide-react";

export interface TicketAttachment {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  download_url: string;
}

export interface TicketHistoryEvent {
  id: string;
  event_type: string;
  actor_name: string | null;
  actor_role: string;
  remark: string | null;
  status: string | null;
  created_at: string;
  attachments: TicketAttachment[];
  document_request_status: string | null;
  document_request_id?: string | null;
}

export function formatTicketDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  const hour = date.getHours();
  return `${pad(date.getDate())}:${pad(date.getMonth() + 1)}:${date.getFullYear()} ${pad(hour % 12 || 12)}:${pad(date.getMinutes())} ${hour >= 12 ? "PM" : "AM"}`;
}

const statusLabel = (status: string) => status.replace(/[_-]/g, " ");

export default function TicketHistory({ events }: { events: TicketHistoryEvent[] }) {
  if (events.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">No history has been recorded for this ticket yet.</div>;
  }

  return (
    <ol className="relative ml-2 border-l-2 border-indigo-200 dark:border-indigo-900">
      {events.map((event) => (
        <li key={event.id} className="relative pb-7 pl-7 last:pb-0">
          <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-[3px] border-indigo-600 bg-white dark:bg-slate-950" aria-hidden="true" />
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{event.actor_name || "Ticket participant"}</p>
                <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{statusLabel(event.actor_role || "participant")}</p>
              </div>
              <time className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatTicketDateTime(event.created_at)}</time>
            </div>

            {(event.status || event.event_type) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {event.status && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{statusLabel(event.status)}</span>}
                {!event.status && event.event_type !== "remark" && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{statusLabel(event.event_type)}</span>}
                {event.document_request_status && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${event.document_request_status === "fulfilled" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
                    Documents {statusLabel(event.document_request_status)}
                  </span>
                )}
              </div>
            )}

            {event.remark && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{event.remark}</p>}

            {event.attachments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {event.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a href={attachment.download_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
                      <FileText size={15} className="shrink-0" />
                      <span className="truncate">{attachment.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{(attachment.size_bytes / (1024 * 1024)).toFixed(2)} MB</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}