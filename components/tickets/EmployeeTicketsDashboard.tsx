"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Check, Clock3, FileText, LoaderCircle, MessageSquare, Paperclip, Send, ShieldCheck } from "lucide-react";
import TicketHistory from "@/components/tickets/TicketHistory";
import { formatTicketDateTime } from "@/components/tickets/TicketHistory";
import type { TicketHistoryEvent } from "@/components/tickets/TicketHistory";

type TicketStatus = "pending" | "in_progress" | "completed";
type TicketAction = "remark" | "status" | "request_document" | "upload";

interface TicketSummary {
  id: string;
  status: string;
  category_title?: string;
  issue_title?: string;
  title?: string;
  description?: string;
  student_name?: string;
  student_id?: string;
  created_at: string;
  updated_at?: string;
}

interface TicketDetail extends TicketSummary {
  history: TicketHistoryEvent[];
}

type TicketFilter = "all" | TicketStatus;

const statusLabels: Record<TicketStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const statusStyles: Record<TicketStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300",
};

const ACCEPTED_FILE_TYPES = [".pdf", ".jpg", ".jpeg", ".mp3", ".mpeg", ".mpg", "application/pdf", "image/jpeg", "audio/mpeg", "video/mpeg"];
const MAX_FILES = 2;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function normalizeStatus(status: string): TicketStatus {
  const normalized = status.toLowerCase().replaceAll(" ", "_");
  if (["completed", "resolved", "closed"].includes(normalized)) return "completed";
  if (["in_progress", "processing"].includes(normalized)) return "in_progress";
  return "pending";
}

function issueTitle(ticket: TicketSummary) {
  return ticket.category_title || ticket.issue_title || ticket.title || "Student inquiry";
}

function FilePicker({ files, onChange, disabled }: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const next = [...files, ...Array.from(selected)];
    if (next.length > MAX_FILES) {
      toast.error("You can attach a maximum of two files.");
      return;
    }
    const invalid = next.find((file) => file.size > MAX_FILE_BYTES || !ACCEPTED_FILE_TYPES.some((type) =>
      type.startsWith(".") ? file.name.toLowerCase().endsWith(type) : file.type === type,
    ));
    if (invalid) {
      toast.error("Each file must be a PDF, JPG, or MPEG file no larger than 2 MB.");
      return;
    }
    onChange(next);
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        Supporting documents (optional, up to 2 files; 2 MB each)
      </label>
      <input
        type="file"
        accept={ACCEPTED_FILE_TYPES.slice(0, 6).join(",")}
        multiple
        disabled={disabled || files.length >= MAX_FILES}
        onChange={(event) => {
          addFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold dark:text-slate-300 dark:file:bg-slate-800"
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1"><Paperclip size={12} />{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              <button type="button" onClick={() => onChange(files.filter((_, i) => i !== index))} disabled={disabled} className="text-rose-600 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function EmployeeTicketsDashboard() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<TicketFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusRemark, setStatusRemark] = useState("");
  const [note, setNote] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [documentRequest, setDocumentRequest] = useState("");
  const [status, setStatus] = useState<TicketStatus>("pending");
  const [files, setFiles] = useState<File[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/employee/tickets", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load assigned tickets.");
      setLoadError("");
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load assigned tickets.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadTickets(), 0);
    return () => clearTimeout(timer);
  }, [loadTickets, refreshKey]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await fetch(`/api/employee/tickets/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load ticket history.");
      const ticket = data.ticket as TicketSummary;
      setDetail({ ...ticket, history: data.history || [] });
      setStatus(normalizeStatus(ticket.status));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load ticket history.";
      setDetailError(message);
      toast.error(message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => void loadDetail(selectedId), 0);
    return () => clearTimeout(timer);
  }, [selectedId, loadDetail, refreshKey]);

  const counts = useMemo(() => ({
    all: tickets.length,
    pending: tickets.filter((ticket) => normalizeStatus(ticket.status) === "pending").length,
    in_progress: tickets.filter((ticket) => normalizeStatus(ticket.status) === "in_progress").length,
    completed: tickets.filter((ticket) => normalizeStatus(ticket.status) === "completed").length,
  }), [tickets]);

  const visibleTickets = useMemo(
    () => filter === "all" ? tickets : tickets.filter((ticket) => normalizeStatus(ticket.status) === filter),
    [tickets, filter],
  );

  async function submitAction(action: TicketAction) {
    if (!selectedId) return;
    if (action === "remark" && !note.trim()) return toast.error("Enter a remark first.");
    if (action === "request_document" && !documentRequest.trim()) return toast.error("Describe the document needed.");
    if (action === "upload" && files.length === 0) return toast.error("Choose at least one file.");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("action", action);
      if (action === "remark") form.set("remark", note.trim());
      if (action === "request_document") form.set("remark", documentRequest.trim());
      if (action === "status") {
        form.set("status", status);
        if (statusRemark.trim()) form.set("remark", statusRemark.trim());
      }
      if (action === "upload" && uploadNote.trim()) form.set("remark", uploadNote.trim());
      if (action === "upload") files.forEach((file) => form.append("files", file));

      const response = await fetch(`/api/employee/tickets/${selectedId}`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update ticket.");
      toast.success(action === "status" ? "Ticket status updated." : action === "request_document" ? "Document request recorded." : action === "upload" ? "Documents uploaded." : "Remark added.");
      setStatusRemark("");
      setNote("");
      setUploadNote("");
      setDocumentRequest("");
      setFiles([]);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update ticket.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assigned Tickets</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review student inquiries, update their status, and keep a clear history of your actions.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ticket statistics">
        {([
          ["all", "Assigned Tasks", ShieldCheck],
          ["pending", "Pending Tasks", Clock3],
          ["in_progress", "In Progress", MessageSquare],
          ["completed", "Completed Tasks", Check],
        ] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setFilter(key)} className={`card-3d flex items-center gap-3 p-4 text-left transition ${filter === key ? "ring-2 ring-indigo-500" : ""}`}>
            <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">{(() => { const Icon = icon; return <Icon size={18} />; })()}</span>
            <span><span className="block text-xs text-slate-500">{label}</span><span className="text-xl font-bold text-slate-900 dark:text-white">{counts[key]}</span></span>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <section className="card-3d overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Assigned tasks</h2>
              <p className="text-xs text-slate-500">{visibleTickets.length} ticket{visibleTickets.length === 1 ? "" : "s"}</p>
            </div>
            <select aria-label="Filter tickets" value={filter} onChange={(event) => setFilter(event.target.value as TicketFilter)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {loading ? <div className="flex justify-center p-10"><LoaderCircle className="animate-spin text-indigo-500" /></div> :
            loadError ? <div className="p-8 text-center text-sm text-rose-600">{loadError}</div> :
            visibleTickets.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No assigned tickets in this list.</p> :
              <ul className="max-h-[670px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {visibleTickets.map((ticket) => {
                  const ticketStatus = normalizeStatus(ticket.status);
                  return (
                    <li key={ticket.id}>
                      <button onClick={() => { setSelectedId(ticket.id); setDetail(null); }} className={`w-full p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedId === ticket.id ? "bg-indigo-50/70 dark:bg-indigo-500/5" : ""}`}>
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{issueTitle(ticket)}</span>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusStyles[ticketStatus]}`}>{statusLabels[ticketStatus]}</span>
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">{ticket.student_name || "Student"} · {formatTicketDateTime(ticket.created_at)}</span>
                        {ticket.description && <span className="mt-2 line-clamp-2 block text-sm text-slate-600 dark:text-slate-300">{ticket.description}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>}
        </section>

        <section className="card-3d min-h-[400px]">
          {!selectedId ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-8 text-center text-slate-400">
              <FileText size={32} className="mb-3 opacity-60" />
              <p className="font-medium">Select an assigned ticket</p>
              <p className="mt-1 text-sm">Its complete history and available actions will appear here.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <LoaderCircle className="animate-spin text-indigo-500" />
            </div>
          ) : !detail ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-rose-600">{detailError || "Ticket details are unavailable."}</p>
              <button onClick={() => setRefreshKey((key) => key + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">Try again</button>
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <button onClick={() => { setSelectedId(""); setDetail(null); }} className="mb-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"><ArrowLeft size={13} /> Back to list</button>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{issueTitle(detail)}</h2>
                  <p className="mt-1 text-xs text-slate-500">From {detail.student_name || "Student"} · Posted {formatTicketDateTime(detail.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[normalizeStatus(detail.status)]}`}>{statusLabels[normalizeStatus(detail.status)]}</span>
              </div>

              {detail.description && <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-900 dark:text-slate-200">{detail.description}</div>}

              <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Ticket history</h3>
                <TicketHistory events={detail.history} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <form onSubmit={(event) => { event.preventDefault(); void submitAction("status"); }} className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100" htmlFor="ticket-status">Update status</label>
                  <select id="ticket-status" value={status} onChange={(event) => setStatus(event.target.value as TicketStatus)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                    <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                  </select>
                  <textarea value={statusRemark} onChange={(event) => setStatusRemark(event.target.value)} maxLength={4000} rows={2} placeholder="Optional status update remark" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  <button disabled={busy} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Check size={14} /> Save status</button>
                </form>

                <form onSubmit={(event) => { event.preventDefault(); void submitAction("remark"); }} className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Add a remark</label>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} rows={3} required placeholder="Write a note visible in the ticket history" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  <button disabled={busy} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-slate-700"><Send size={14} /> Add remark</button>
                </form>

                <form onSubmit={(event) => { event.preventDefault(); void submitAction("request_document"); }} className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Request a document</label>
                  <textarea value={documentRequest} onChange={(event) => setDocumentRequest(event.target.value)} maxLength={1000} rows={2} required placeholder="Tell the student what document is needed" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  <button disabled={busy} className="flex items-center gap-2 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300"><FileText size={14} /> Send request</button>
                </form>

                <form onSubmit={(event) => { event.preventDefault(); void submitAction("upload"); }} className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Upload documents</label>
                  <FilePicker files={files} onChange={setFiles} disabled={busy} />
                  <input value={uploadNote} onChange={(event) => setUploadNote(event.target.value)} maxLength={1000} placeholder="Optional note for the history" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  <button disabled={busy || !files.length} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Paperclip size={14} /> Upload to history</button>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}