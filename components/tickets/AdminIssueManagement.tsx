"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertCircle, ArrowLeft, Check, ChevronRight, CircleDot, ClipboardList, FileText, LoaderCircle, MessageSquare, Paperclip, Plus, Search, Send, ShieldCheck, Tag, UserRound, Users, X } from "lucide-react";
import TicketHistory, { type TicketHistoryEvent } from "@/components/tickets/TicketHistory";

type TicketStatus = "pending" | "in_progress" | "completed";
type Tab = "tickets" | "categories";
type Category = { id: string; title: string; active: boolean; is_active?: boolean; created_at?: string };
type Ticket = {
  id: string;
  category_title?: string;
  issue_title?: string;
  title?: string;
  student_name?: string;
  student_roll_no?: string | null;
  roll_no?: string | null;
  student_email?: string | null;
  status: TicketStatus;
  description?: string;
  created_at: string;
  assigned_to?: string | null;
  assignee_id?: string | null;
  assigned_name?: string | null;
  assignee_name?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
};
type Assignee = { id: string; name: string; role: string };

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["application/pdf", "image/jpeg", "audio/mpeg", "video/mpeg"]);
const ACCEPTED_EXT = /\.(pdf|jpe?g|mpeg|mpg|mp3)$/i;
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-indigo-900/30";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function getCategoryTitle(ticket: Ticket) {
  return ticket.category_title || ticket.issue_title || ticket.title || "Issue";
}

function getAssigneeId(ticket: Ticket) {
  return ticket.assigned_user_id || ticket.assigned_to || ticket.assignee_id || "";
}

function getAssigneeName(ticket: Ticket) {
  return ticket.assigned_user_name || ticket.assigned_name || ticket.assignee_name || "Unassigned";
}

function statusLabel(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  return "Pending";
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (status === "in_progress") return "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
}

function formatPostedDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function validateFiles(files: File[]) {
  if (files.length > 2) return "Upload no more than two files at a time.";
  const invalid = files.find((file) =>
    file.size > MAX_FILE_SIZE ||
    !(ACCEPTED_MIME.has(file.type) || ACCEPTED_EXT.test(file.name)),
  );
  if (invalid) {
    if (invalid.size > MAX_FILE_SIZE) return `${invalid.name} exceeds the 2 MB per-file limit.`;
    return `${invalid.name} is not a supported PDF, JPG, or MPEG file.`;
  }
  return "";
}

export default function AdminIssueManagement() {
  const [tab, setTab] = useState<Tab>("tickets");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "active" | "inactive">("all");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatus, setTicketStatus] = useState<"all" | TicketStatus>("all");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<TicketHistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [assigneeSelection, setAssigneeSelection] = useState("");
  const [statusSelection, setStatusSelection] = useState<TicketStatus>("pending");
  const [remark, setRemark] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/tickets", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load tickets.");
      setTickets(data.tickets ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoryLoading(true);
    try {
      const response = await fetch("/api/admin/ticket-categories", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load issue titles.");
      setCategories(data.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load issue titles.");
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  const loadAssignees = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ticket-assignees", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load eligible employees.");
      setAssignees(data.assignees ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load eligible employees.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTickets();
      void loadCategories();
      void loadAssignees();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadTickets, loadCategories, loadAssignees]);

  const visibleTickets = useMemo(() => {
    const needle = ticketSearch.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (ticketStatus !== "all" && ticket.status !== ticketStatus) return false;
      if (!needle) return true;
      return [
        getCategoryTitle(ticket),
        ticket.student_name,
        ticket.student_roll_no,
        ticket.roll_no,
        getAssigneeName(ticket),
        ticket.id,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [tickets, ticketSearch, ticketStatus]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => categoryFilter === "all" ||
      (categoryFilter === "active" ? (category.is_active ?? category.active) : !(category.is_active ?? category.active))),
    [categories, categoryFilter],
  );

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
    setSelectedTicket(ticket);
    setHistory([]);
    setHistoryLoading(true);
    setAssigneeSelection(getAssigneeId(ticket));
    setStatusSelection(ticket.status);
    setRemark("");
    setFiles([]);
    try {
      const response = await fetch(`/api/admin/tickets/${encodeURIComponent(ticket.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load ticket history.");
      setSelectedTicket(data.ticket ?? ticket);
      setHistory(data.history ?? []);
      setAssigneeSelection(getAssigneeId(data.ticket ?? ticket));
      setStatusSelection((data.ticket ?? ticket).status);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load ticket history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = categoryTitle.trim();
    if (!title) return toast.error("Enter an issue title.");
    setSavingCategory(true);
    try {
      const response = await fetch("/api/admin/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add the issue title.");
      toast.success("Issue title added.");
      setCategoryTitle("");
      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the issue title.");
    } finally {
      setSavingCategory(false);
    }
  };

  const saveCategory = async (category: Category) => {
    const title = editingTitle.trim();
    if (!title) return toast.error("Issue title cannot be empty.");
    setSavingCategory(true);
    try {
      const response = await fetch("/api/admin/ticket-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id, title }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the issue title.");
      toast.success("Issue title updated.");
      setEditingCategoryId("");
      setEditingTitle("");
      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the issue title.");
    } finally {
      setSavingCategory(false);
    }
  };

  const deactivateCategory = async (category: Category) => {
    if (!window.confirm(`Deactivate "${category.title}"? Existing tickets will keep this issue title.`)) return;
    try {
      const response = await fetch(`/api/admin/ticket-categories?id=${encodeURIComponent(category.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not deactivate the issue title.");
      toast.success("Issue title deactivated.");
      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deactivate the issue title.");
    }
  };

  const runTicketAction = async (action: string, values: Record<string, string> = {}, attachedFiles: File[] = []) => {
    if (!selectedTicket) return;
    const fileError = validateFiles(attachedFiles);
    if (fileError) {
      toast.error(fileError);
      return;
    }
    setActionLoading(true);
    try {
      const body = new FormData();
      body.set("action", action);
      for (const [key, value] of Object.entries(values)) body.set(key, value);
      attachedFiles.forEach((file) => body.append("files", file));
      const response = await fetch(`/api/admin/tickets/${encodeURIComponent(selectedTicket.id)}`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the ticket.");
      toast.success(data.message || "Ticket updated.");
      setRemark("");
      setFiles([]);
      await Promise.all([loadTickets(), openTicket(selectedTicket)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the ticket.");
    } finally {
      setActionLoading(false);
    }
  };

  const onFilesSelected = (input: FileList | null) => {
    const nextFiles = input ? Array.from(input) : [];
    const error = validateFiles(nextFiles);
    if (error) {
      toast.error(error);
      setFiles([]);
      return;
    }
    setFiles(nextFiles);
  };

  const counts = useMemo(() => ({
    all: tickets.length,
    pending: tickets.filter((ticket) => ticket.status === "pending").length,
    in_progress: tickets.filter((ticket) => ticket.status === "in_progress").length,
    completed: tickets.filter((ticket) => ticket.status === "completed").length,
  }), [tickets]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
            <ShieldCheck size={15} /> Administration
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Issue Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage issue titles, student inquiries, assignments, and resolution history.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Users size={16} className="text-indigo-500" /> {tickets.length} total tickets
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["All tickets", counts.all, "text-indigo-600"],
          ["Pending", counts.pending, "text-amber-600"],
          ["In progress", counts.in_progress, "text-sky-600"],
          ["Completed", counts.completed, "text-emerald-600"],
        ] as const).map(([label, count, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {([
          ["tickets", "All Tickets", ClipboardList],
          ["categories", "Issue Titles", Tag],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === key ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "categories" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
          <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"><Plus size={19} /></span>
              <div><h2 className="font-semibold text-slate-900 dark:text-white">Add issue title</h2><p className="text-xs text-slate-500">Students select this when opening a ticket.</p></div>
            </div>
            <form onSubmit={addCategory} className="space-y-3">
              <label htmlFor="issue-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Issue Title</label>
              <input id="issue-title" maxLength={120} value={categoryTitle} onChange={(event) => setCategoryTitle(event.target.value)} placeholder="e.g. Transcript Request" className={inputClass} />
              <button type="submit" disabled={savingCategory} className={`${buttonClass} w-full bg-indigo-600 text-white hover:bg-indigo-700`}>
                {savingCategory ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Add Category
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div><h2 className="font-semibold text-slate-900 dark:text-white">Issue Titles</h2><p className="text-xs text-slate-500">Inactive titles remain attached to their existing tickets.</p></div>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="all">All titles</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
            {categoryLoading ? <div className="flex justify-center p-10"><LoaderCircle className="animate-spin text-indigo-500" /></div> :
              visibleCategories.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No issue titles in this view yet.</div> :
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleCategories.map((category) => {
                    const active = category.is_active ?? category.active ?? true;
                    const editing = editingCategoryId === category.id;
                    return <div key={category.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        {editing ? <input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} maxLength={120} className={inputClass} aria-label="Edit issue title" /> :
                          <p className="font-medium text-slate-800 dark:text-slate-100">{category.title}</p>}
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{active ? "Active" : "Inactive"}</span>
                      </div>
                      {editing ? <>
                        <button onClick={() => void saveCategory(category)} disabled={savingCategory} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" aria-label="Save title"><Check size={18} /></button>
                        <button onClick={() => { setEditingCategoryId(""); setEditingTitle(""); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cancel edit"><X size={18} /></button>
                      </> : <>
                        <button onClick={() => { setEditingCategoryId(category.id); setEditingTitle(category.title); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">Edit</button>
                        {active && <button onClick={() => void deactivateCategory(category)} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">Deactivate</button>}
                      </>}
                    </div>;
                  })}
                </div>}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={ticketSearch} onChange={(event) => setTicketSearch(event.target.value)} placeholder="Search by student, issue, assignee, or ticket…" className={`${inputClass} pl-9`} />
            </div>
            <select value={ticketStatus} onChange={(event) => setTicketStatus(event.target.value as typeof ticketStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="all">All statuses</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
            </select>
            <button onClick={() => void loadTickets()} disabled={loading} className={`${buttonClass} border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : "Refresh"}</button>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {loading ? <div className="flex justify-center p-12"><LoaderCircle className="animate-spin text-indigo-500" /></div> :
              visibleTickets.length === 0 ? <div className="px-5 py-14 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><MessageSquare size={22} /></span>
                <p className="font-medium text-slate-700 dark:text-slate-200">No tickets found</p><p className="mt-1 text-sm text-slate-500">New student inquiries will appear here.</p>
              </div> :
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/70">
                      <tr><th className="px-5 py-3">Issue / Ticket</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Posted</th><th className="px-5 py-3">Assigned employee</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">History</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleTickets.map((ticket) => <tr key={ticket.id} className={`transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${selectedTicketId === ticket.id ? "bg-indigo-50/60 dark:bg-indigo-500/5" : ""}`}>
                        <td className="px-5 py-4"><p className="font-semibold text-slate-800 dark:text-slate-100">{getCategoryTitle(ticket)}</p><p className="mt-0.5 font-mono text-[11px] text-slate-400">#{ticket.id.slice(0, 8)}</p></td>
                        <td className="px-5 py-4"><p className="font-medium text-slate-700 dark:text-slate-200">{ticket.student_name || "Student"}</p><p className="mt-0.5 text-xs text-slate-500">{ticket.student_roll_no || ticket.roll_no || "—"}</p></td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatPostedDate(ticket.created_at)}</td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{getAssigneeName(ticket)}</td>
                        <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span></td>
                        <td className="px-5 py-4 text-right"><button onClick={() => void openTicket(ticket)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">View <ChevronRight size={14} /></button></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>}
          </section>

          {selectedTicket && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <button onClick={() => { setSelectedTicket(null); setSelectedTicketId(""); setHistory([]); }} className="mt-0.5 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close ticket history"><ArrowLeft size={18} /></button>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-900 dark:text-white">{getCategoryTitle(selectedTicket)}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(selectedTicket.status)}`}>{statusLabel(selectedTicket.status)}</span></div>
                  <p className="text-sm text-slate-500">{selectedTicket.student_name || "Student"} · {selectedTicket.student_roll_no || selectedTicket.roll_no || "No roll number"} · Posted {formatPostedDate(selectedTicket.created_at)}</p>
                  {selectedTicket.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{selectedTicket.description}</p>}
                </div>
              </div>
              <button onClick={() => void openTicket(selectedTicket)} disabled={historyLoading} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Refresh ticket history"><LoaderCircle size={16} className={historyLoading ? "animate-spin" : ""} /></button>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,0.8fr)]">
              <div className="border-b border-slate-100 p-5 dark:border-slate-800 xl:border-b-0 xl:border-r">
                <div className="mb-4 flex items-center gap-2"><CircleDot size={17} className="text-indigo-600" /><h3 className="font-semibold text-slate-900 dark:text-white">Ticket History</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">{history.length}</span></div>
                {historyLoading ? <div className="flex justify-center py-10"><LoaderCircle className="animate-spin text-indigo-500" /></div> :
                  history.length ? <TicketHistory events={history} /> :
                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No history has been recorded yet.</div>}
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><UserRound size={17} className="text-indigo-600" /> Assignment</h3>
                  <div className="flex gap-2">
                    <select value={assigneeSelection} onChange={(event) => setAssigneeSelection(event.target.value)} className={`${inputClass} min-w-0`}>
                      <option value="">{getAssigneeName(selectedTicket)}</option>
                      {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name} · {assignee.role}</option>)}
                    </select>
                    <button onClick={() => void runTicketAction("assign", { assignee_id: assigneeSelection })} disabled={actionLoading || !assigneeSelection} className={`${buttonClass} shrink-0 bg-indigo-600 px-3 text-white hover:bg-indigo-700`} aria-label="Assign ticket"><Check size={16} /></button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Only eligible employees are available for assignment.</p>
                </div>

                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><CircleDot size={17} className="text-sky-600" /> Update status</h3>
                  <div className="flex gap-2">
                    <select value={statusSelection} onChange={(event) => setStatusSelection(event.target.value as TicketStatus)} className={`${inputClass} min-w-0`}>
                      <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
                    </select>
                    <button onClick={() => void runTicketAction("status", { status: statusSelection })} disabled={actionLoading || statusSelection === selectedTicket.status} className={`${buttonClass} shrink-0 bg-slate-900 px-3 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200`}><Check size={16} /> Update</button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><MessageSquare size={17} className="text-indigo-600" /> Add a remark</h3>
                  <textarea value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} maxLength={2000} placeholder="Write an update for the student and assigned employee…" className={inputClass} />
                  <button onClick={() => void runTicketAction("remark", { remark })} disabled={actionLoading || !remark.trim()} className={`${buttonClass} mt-2 w-full bg-indigo-600 text-white hover:bg-indigo-700`}><Send size={15} /> Add Remark</button>
                </div>

                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><FileText size={17} className="text-amber-600" /> Request documents</h3>
                  <p className="mb-3 text-xs leading-5 text-slate-500">The student will see this request in the ticket history and can reply with supporting files.</p>
                  <textarea value={remark} onChange={(event) => setRemark(event.target.value)} rows={2} maxLength={2000} placeholder="Describe which document is needed…" className={inputClass} />
                  <button onClick={() => void runTicketAction("request_document", { remark })} disabled={actionLoading || !remark.trim()} className={`${buttonClass} mt-2 w-full border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300`}><FileText size={15} /> Send document request</button>
                </div>

                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Paperclip size={17} className="text-slate-500" /> Upload documents</h3>
                  <p className="mb-3 text-xs leading-5 text-slate-500">Documents are recorded as a history event under the ticket’s current status.</p>
                  <input type="file" multiple accept="application/pdf,image/jpeg,audio/mpeg,video/mpeg,.pdf,.jpg,.jpeg,.mpeg,.mpg,.mp3" onChange={(event) => onFilesSelected(event.target.files)} className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200" />
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500"><AlertCircle size={13} className="mt-0.5 shrink-0" /> Up to 2 files per update · 2 MB each · PDF, JPG, MPEG.</p>
                  {files.length > 0 && <div className="mt-2 space-y-1">{files.map((file) => <p key={`${file.name}-${file.size}`} className="truncate text-xs text-slate-600 dark:text-slate-300">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>)}</div>}
                  <button onClick={() => void runTicketAction("upload", {}, files)} disabled={actionLoading || files.length === 0} className={`${buttonClass} mt-3 w-full border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}><Paperclip size={15} /> Attach to history</button>
                </div>
              </div>
            </div>
          </section>}
        </div>
      )}
    </div>
  );
}