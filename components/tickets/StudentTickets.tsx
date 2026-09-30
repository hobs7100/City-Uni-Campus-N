"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FilePlus2, MessageSquarePlus, RefreshCw, Send, Ticket as TicketIcon, Upload } from "lucide-react";
import toast from "react-hot-toast";
import TicketHistory, { TicketHistoryEvent } from "@/components/tickets/TicketHistory";
import { ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";

const MAX_TICKET_FILES = 2;
const MAX_TICKET_FILE_BYTES = 2 * 1024 * 1024;
const MAX_DESCRIPTION_WORDS = 1000;
const ACCEPTED_TICKET_TYPES = new Set(["application/pdf", "image/jpeg", "audio/mpeg", "video/mpeg"]);
const ACCEPTED_TICKET_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".mp3", ".mpeg", ".mpg"];
const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.mp3,.mpeg,.mpg,application/pdf,image/jpeg,audio/mpeg,video/mpeg";

interface TicketCategory {
  id: string;
  title: string;
}

interface TicketSummary {
  id: string;
  category_title?: string;
  category?: string;
  status: string;
  description: string;
  created_at: string;
  assigned_name?: string | null;
  assigned_user_name?: string | null;
}

interface TicketDetail extends TicketSummary {
  history: TicketHistoryEvent[];
}

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function isAllowedTicketFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_TICKET_TYPES.has(file.type) || ACCEPTED_TICKET_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function validateTicketFiles(files: File[]) {
  if (files.length > MAX_TICKET_FILES) return `You can attach a maximum of ${MAX_TICKET_FILES} files.`;
  if (files.some((file) => file.size > MAX_TICKET_FILE_BYTES)) return "Each attachment must be 2 MB or smaller.";
  if (files.some((file) => !isAllowedTicketFile(file))) return "Attachments must be PDF, JPG, or MPEG files.";
  return "";
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "resolved" || normalized === "closed") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (normalized === "in_progress" || normalized === "in progress") return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
}

export default function StudentTickets() {
  const [view, setView] = useState<"new" | "all">("new");
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [requestFiles, setRequestFiles] = useState<Record<string, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remark, setRemark] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [uploadingRequestId, setUploadingRequestId] = useState("");
  const [datePosted, setDatePosted] = useState("—");
  const wordCount = useMemo(() => countWords(description), [description]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDatePosted(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoryLoading(true);
    try {
      const response = await fetch("/api/student/ticket-categories", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load ticket categories.");
      setCategories(data.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load ticket categories.");
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const response = await fetch("/api/student/tickets", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load your tickets.");
      setTickets(data.tickets ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load your tickets.");
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (ticketId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/student/tickets/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load ticket history.");
      setSelectedTicket({ ...data.ticket, history: data.history ?? [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load ticket history.");
      setSelectedTicket(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCategories();
      void loadTickets();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCategories, loadTickets]);

  const submitTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!categoryId) return toast.error("Select an issue category.");
    if (!description.trim()) return toast.error("Enter a description.");
    if (wordCount > MAX_DESCRIPTION_WORDS) return toast.error("Description cannot exceed 1,000 words.");
    const filesError = validateTicketFiles(files);
    if (filesError) return toast.error(filesError);

    const form = new FormData();
    form.set("category_id", categoryId);
    form.set("description", description.trim());
    files.forEach((file) => form.append("files", file));
    setSubmitting(true);
    try {
      const response = await fetch("/api/student/tickets", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit your ticket.");
      toast.success("Ticket submitted.");
      setDescription("");
      setCategoryId("");
      setFiles([]);
      if (data.ticket?.id) {
        await loadTickets();
        await loadDetail(data.ticket.id);
      } else {
        await loadTickets();
      }
      setView("all");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit your ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const postStudentAction = async (action: "remark" | "upload", requestId: string, uploadFiles: File[] = []) => {
    if (!selectedTicket) return;
    if (action === "remark" && !remark.trim()) return toast.error("Enter a remark first.");
    if (action === "upload" && uploadFiles.length === 0) return toast.error("Select at least one document.");
    const filesError = validateTicketFiles(uploadFiles);
    if (filesError) return toast.error(filesError);
    const form = new FormData();
    form.set("action", action);
    if (remark.trim() && action === "remark") form.set("remark", remark.trim());
    if (requestId) form.set("request_id", requestId);
    uploadFiles.forEach((file) => form.append("files", file));
    if (action === "remark") setRemarkSaving(true);
    else setUploadingRequestId(requestId);
    try {
      const response = await fetch(`/api/student/tickets/${encodeURIComponent(selectedTicket.id)}`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update this ticket.");
      toast.success(action === "remark" ? "Remark added." : "Documents uploaded.");
      setRemark("");
      if (action === "upload") {
        setRequestFiles((current) => {
          const next = { ...current };
          delete next[requestId];
          return next;
        });
      }
      await loadDetail(selectedTicket.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update this ticket.");
    } finally {
      setRemarkSaving(false);
      setUploadingRequestId("");
    }
  };

  const openTicket = async (ticket: TicketSummary) => {
    setSelectedTicket({ ...ticket, history: [] });
    setView("all");
    await loadDetail(ticket.id);
  };

  const handleFileSelection = (selected: FileList | null, setValue: (files: File[]) => void, input: HTMLInputElement) => {
    const nextFiles = Array.from(selected ?? []);
    const error = validateTicketFiles(nextFiles);
    if (error) {
      toast.error(error);
      input.value = "";
      return;
    }
    setValue(nextFiles);
  };

  const removeFile = (index: number) => setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tickets / Inquiry</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submit an issue and follow its updates and document requests.</p>
        </div>
        {selectedTicket && (
          <button type="button" onClick={() => { setSelectedTicket(null); void loadTickets(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <ArrowLeft size={15} /> Back to tickets
          </button>
        )}
      </div>

      {!selectedTicket && (
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
          {(["new", "all"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => { setView(tab); if (tab === "all") void loadTickets(); }} className={`border-b-2 px-4 py-2.5 text-sm font-semibold capitalize transition ${view === tab ? "border-indigo-600 text-indigo-700 dark:text-indigo-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
              {tab === "new" ? "New Ticket" : "All Tickets"}
            </button>
          ))}
        </div>
      )}

      {detailLoading ? <DataFetchLoader label="Loading ticket history…" /> : null}
      {selectedTicket && !detailLoading && (
        <div className="space-y-5">
          <div className="card-3d p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket · {selectedTicket.id.slice(0, 8)}</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.category_title || selectedTicket.category || "Issue"}</h3>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(selectedTicket.status)}`}>{selectedTicket.status.replace(/[_-]/g, " ")}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedTicket.description}</p>
              <p className="mt-3 text-xs text-slate-500">Date posted: {dateLabel(selectedTicket.created_at)}{(selectedTicket.assigned_name || selectedTicket.assigned_user_name) ? ` · Assigned to ${selectedTicket.assigned_name || selectedTicket.assigned_user_name}` : ""}</p>
          </div>

          <div className="card-3d p-5 sm:p-6">
            <h3 className="mb-5 text-lg font-bold text-slate-900 dark:text-white">Ticket History</h3>
            <TicketHistory events={selectedTicket.history} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={(event) => { event.preventDefault(); void postStudentAction("remark", ""); }} className="card-3d space-y-3 p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><MessageSquarePlus size={17} /> Add a remark</h3>
              <textarea value={remark} onChange={(event) => setRemark(event.target.value)} rows={4} maxLength={4000} placeholder="Add information or respond to an update…" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              <button disabled={remarkSaving || !remark.trim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{remarkSaving ? <ButtonLoader /> : <Send size={15} />} Post remark</button>
            </form>

            <div className="card-3d space-y-3 p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Upload size={17} /> Requested documents</h3>
              {selectedTicket.history.filter((event) => event.document_request_status === "pending").length === 0 ? (
                <p className="text-sm text-slate-500">There are no open document requests.</p>
              ) : selectedTicket.history.filter((event) => event.document_request_status === "pending").map((request) => (
                <div key={request.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{request.remark || "Please upload the requested documents."}</p>
                  <p className="mt-1 text-xs text-amber-800/70 dark:text-amber-200/70">Requested {dateLabel(request.created_at)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input aria-label="Choose requested documents" type="file" accept={FILE_ACCEPT} multiple onChange={(event) => handleFileSelection(event.target.files, (nextFiles) => setRequestFiles((current) => ({ ...current, [request.id]: nextFiles })), event.currentTarget)} className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1.5 file:text-xs file:font-semibold dark:text-slate-300 dark:file:bg-slate-800" data-ticket-request={request.id} />
                    {requestFiles[request.id]?.length ? <p className="mt-1 basis-full text-xs text-slate-500">{requestFiles[request.id].map((file) => file.name).join(", ")}</p> : null}
                    <button type="button" disabled={uploadingRequestId === request.id} onClick={() => {
                      const uploadFiles = requestFiles[request.id] ?? [];
                      void postStudentAction("upload", request.document_request_id || request.id, uploadFiles);
                    }} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                      {uploadingRequestId === request.id ? <ButtonLoader /> : <Upload size={13} />} Upload
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!selectedTicket && view === "new" && (
        <form onSubmit={submitTicket} className="card-3d max-w-3xl space-y-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><FilePlus2 size={20} /></span>
            <div><h3 className="font-bold text-slate-900 dark:text-white">New Ticket</h3><p className="text-xs text-slate-500">Describe your issue clearly so the right team can help.</p></div>
          </div>

          <div>
            <label htmlFor="ticket-category" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Issue category <span className="text-red-500">*</span></label>
            <select id="ticket-category" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={categoryLoading} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option value="">{categoryLoading ? "Loading issue titles…" : "Select an issue title"}</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
            </select>
            {!categoryLoading && categories.length === 0 && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">No issue categories are available yet. Please check again later.</p>}
          </div>

          <div>
            <label htmlFor="ticket-date-posted" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Date Posted</label>
            <input id="ticket-date-posted" type="text" readOnly aria-readonly="true" value={datePosted} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="ticket-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Issue details <span className="text-red-500">*</span></label>
              <span className={`text-xs ${wordCount > MAX_DESCRIPTION_WORDS ? "font-semibold text-red-600" : "text-slate-500"}`}>{wordCount.toLocaleString()} / {MAX_DESCRIPTION_WORDS} words</span>
            </div>
            <textarea id="ticket-description" required value={description} onChange={(event) => setDescription(event.target.value)} rows={7} placeholder="Explain the issue and include any useful details…" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </div>

          <div>
            <label htmlFor="ticket-files" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Supporting files <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="ticket-files" type="file" accept={FILE_ACCEPT} multiple onChange={(event) => handleFileSelection(event.target.files, setFiles, event.currentTarget)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-500/10 dark:file:text-indigo-300" />
            <p className="mt-1.5 text-xs text-slate-500">PDF, JPG, or MPEG · up to {MAX_TICKET_FILES} files · each file up to 2 MB</p>
            {files.length > 0 && <ul className="mt-2 space-y-1">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300"><span className="truncate">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span><button type="button" onClick={() => removeFile(index)} className="text-red-600 hover:underline">Remove</button></li>)}</ul>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500">Your ticket history is visible only to you and authorized staff.</p>
            <button type="submit" disabled={submitting || categoryLoading || categories.length === 0 || !categoryId || wordCount === 0 || wordCount > MAX_DESCRIPTION_WORDS} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <ButtonLoader /> : <TicketIcon size={16} />} Submit ticket
            </button>
          </div>
        </form>
      )}

      {!selectedTicket && view === "all" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">All Tickets</h3>
            <button type="button" onClick={() => void loadTickets()} disabled={ticketsLoading} aria-label="Refresh tickets" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{ticketsLoading ? <ButtonLoader /> : <RefreshCw size={14} />} Refresh</button>
          </div>
          {ticketsLoading ? <DataFetchLoader label="Loading your tickets…" /> : tickets.length === 0 ? (
            <div className="card-3d p-10 text-center"><TicketIcon size={28} className="mx-auto text-slate-300" /><p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">No tickets yet</p><p className="mt-1 text-sm text-slate-500">Use New Ticket to submit an inquiry.</p></div>
          ) : (
            <div className="overflow-hidden card-3d">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"><tr><th className="px-4 py-3">Issue</th><th className="px-4 py-3">Date Posted</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3 text-right">History</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3"><p className="font-semibold text-slate-800 dark:text-slate-100">{ticket.category_title || ticket.category || "Issue"}</p><p className="mt-0.5 max-w-md truncate text-xs text-slate-500">{ticket.description}</p></td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{dateLabel(ticket.created_at)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(ticket.status)}`}>{ticket.status.replace(/[_-]/g, " ")}</span></td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ticket.assigned_name || "Not assigned"}</td>
                        <td className="px-4 py-3 text-right"><button type="button" onClick={() => void openTicket(ticket)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"><MessageSquarePlus size={14} /> View history</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}