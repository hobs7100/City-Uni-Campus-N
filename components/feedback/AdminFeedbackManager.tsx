"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { DataFetchLoader, ButtonLoader } from "@/components/ui/Loaders";

type Row = {
  id: string;
  category: string;
  status: string;
  created_at: string;
  student_name: string;
  contact: string | null;
  class_name: string;
  session: string;
  active_semester: string | null;
  unread_count: number;
};
type Detail = {
  complaint: Row & { body: string; other_issue?: string };
  attachments: { id: string; url: string }[];
  comments: { id: string; author_role: string; body: string; created_at: string }[];
  status_history: { id: string; status: string; created_at: string }[];
};

const statuses = ["submitted", "open", "in_progress", "resolved", "rejected"];
const nice = (value: string) => value.replace(/_/g, " ");
const statusTone: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  open: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  in_progress: "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  resolved: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  rejected: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
};

function apiError(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload) return payload;
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const flattened = error as { formErrors?: unknown; fieldErrors?: Record<string, unknown> };
      const messages = [
        ...(Array.isArray(flattened.formErrors) ? flattened.formErrors : []),
        ...Object.values(flattened.fieldErrors || {}).flatMap((item) => Array.isArray(item) ? item : [item]),
      ].filter((item): item is string => typeof item === "string" && Boolean(item));
      if (messages.length) return messages.join(" ");
    }
  }
  return fallback;
}

export default function AdminFeedbackManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [filter, setFilter] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const detailRequestId = useRef(0);

  async function load(silent = false): Promise<boolean> {
    const request = ++requestId.current;
    if (!silent) {
      setLoading(true);
      setListError("");
    }
    try {
      const response = await fetch("/api/admin/feedback");
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(payload, "Unable to load feedback."));
      if (!Array.isArray(payload)) throw new Error("Invalid feedback response.");
      if (request === requestId.current) {
        setRows(payload);
        setListError("");
      }
      return true;
    } catch (error) {
      if (request === requestId.current) setListError(error instanceof Error ? error.message : "Unable to load feedback.");
      return false;
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refresh = window.setInterval(() => void load(true), 20_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(refresh);
    };
  }, []);

  async function open(id: string): Promise<boolean> {
    const request = ++detailRequestId.current;
    try {
      const response = await fetch(`/api/admin/feedback/${id}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(payload, "Unable to open feedback."));
      if (request !== detailRequestId.current) return true;
      if (detail?.complaint.id !== id) setReply("");
      setDetail(payload);
      setRows((current) => current.map((row) => row.id === id ? { ...row, unread_count: 0 } : row));
      return await load(true);
    } catch (error) {
      if (request !== detailRequestId.current) return true;
      if (request === detailRequestId.current) toast.error(error instanceof Error ? error.message : "Unable to open feedback.");
      return false;
    }
  }

  function close() {
    detailRequestId.current += 1;
    setDetail(null);
    setReply("");
  }

  async function send() {
    if (!detail || !reply.trim() || reply.length > 1000) return;
    const activeRequest = detailRequestId.current;
    const complaintId = detail.complaint.id;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/feedback/${complaintId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(payload, "Unable to send reply."));
      if (activeRequest === detailRequestId.current) setReply("");
      toast.success("Reply sent.");
      if (activeRequest === detailRequestId.current) {
        if (!(await open(complaintId))) toast.error("Reply sent, but the conversation could not be refreshed.");
      } else {
        await load(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send reply.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: string) {
    if (!detail) return;
    const activeRequest = detailRequestId.current;
    const complaintId = detail.complaint.id;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/feedback/${complaintId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(payload, "Unable to update status."));
      toast.success("Status updated.");
      if (activeRequest === detailRequestId.current) {
        if (!(await open(complaintId))) toast.error("Status updated, but the conversation could not be refreshed.");
      } else {
        await load(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update status.");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => statuses.reduce<Record<string, number>>((result, status) => {
    result[status] = rows.filter((row) => row.status === status).length;
    return result;
  }, {}), [rows]);
  const visible = filter ? rows.filter((row) => row.status === filter) : rows;
  const unread = rows.reduce((total, row) => total + (Number.isInteger(row.unread_count) ? row.unread_count : 0), 0);

  return (
    <div className="min-h-[70dvh] space-y-5 text-slate-800 dark:text-slate-100">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-indigo-900/15 sm:p-7">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[28px] border-white/10" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-100">Staff inbox</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Feedback System</h1><p className="mt-2 max-w-xl text-sm text-indigo-100">Review student concerns, keep the conversation clear, and move each case forward.</p></div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm"><p className="text-2xl font-bold">{unread}</p><p className="text-xs text-indigo-100">unread messages</p></div>
          </div>
        </div>
      </header>

      <section className="card-3d overflow-hidden">
        <div className="border-b border-slate-200/80 p-3 dark:border-slate-700 sm:p-4">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Feedback status filters">
            <button role="tab" aria-selected={!filter} onClick={() => setFilter("")} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${!filter ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-500 hover:bg-indigo-50 dark:hover:bg-slate-800"}`}>All <span className="ml-1 opacity-80">{rows.length}</span></button>
            {statuses.map((status) => <button role="tab" aria-selected={filter === status} key={status} onClick={() => setFilter(status)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${filter === status ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-500 hover:bg-indigo-50 dark:hover:bg-slate-800"}`}>{nice(status)} <span className="ml-1 opacity-80">{counts[status] || 0}</span></button>)}
          </div>
        </div>
        {loading ? <div className="p-6"><DataFetchLoader label="Loading complaints…" /></div> : listError ? <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"><p className="font-semibold">Could not load feedback</p><p className="mt-1">{listError}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white">Try again</button></div> : visible.length === 0 ? <div className="p-12 text-center"><p className="font-semibold">No feedback here yet</p><p className="mt-1 text-sm text-slate-500">{filter ? `There are no ${nice(filter)} complaints.` : "New student complaints will appear in this inbox."}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/40"><th className="p-3 pl-5">Student</th><th className="p-3">Class + session</th><th className="p-3">Semester</th><th className="p-3">Cell no.</th><th className="p-3">Complaint about</th><th className="p-3">Status</th><th className="p-3 pr-5">Action</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className={`border-b border-slate-100 transition hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-slate-800/50 ${row.unread_count > 0 ? "bg-indigo-50/25 dark:bg-indigo-500/[.04]" : ""}`}><td className="p-3 pl-5"><div className="flex items-center gap-2"><span className="font-semibold">{row.student_name}</span>{row.unread_count > 0 && <span aria-label={`${row.unread_count} unread messages`} className="inline-flex min-w-5 items-center justify-center rounded-full bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{row.unread_count}</span>}</div></td><td className="p-3 text-slate-600 dark:text-slate-300">{row.class_name} <span className="text-slate-400">·</span> {row.session}</td><td className="p-3">{row.active_semester || "—"}</td><td className="p-3">{row.contact || "—"}</td><td className="p-3">{row.category}</td><td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${statusTone[row.status] || "bg-slate-100 text-slate-700 ring-slate-200"}`}>{nice(row.status)}</span></td><td className="p-3 pr-5"><button onClick={() => void open(row.id)} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20">View conversation</button></td></tr>)}</tbody></table></div>}
      </section>

      {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" onClick={close}><div role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title" className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#fbfbfe] shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-fuchsia-50 p-5 dark:border-slate-700 dark:from-indigo-950/50 dark:to-fuchsia-950/30"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Student complaint</p><h2 id="feedback-dialog-title" className="mt-1 text-xl font-bold">{detail.complaint.category}</h2><p className="mt-1 text-sm text-slate-500">{detail.complaint.student_name} · {detail.complaint.class_name} · {detail.complaint.session}</p></div><button aria-label="Close conversation" onClick={close} className="rounded-lg px-3 py-1 text-2xl leading-none text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800">×</button></div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm dark:border-indigo-500/20 dark:bg-slate-800/60"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Original complaint</span><span className="text-xs text-slate-400">{new Date(detail.complaint.created_at).toLocaleString()}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{detail.complaint.body}</p>{detail.complaint.other_issue && <p className="mt-2 text-sm text-slate-500">Issue: {detail.complaint.other_issue}</p>}</div>
          {detail.attachments.length > 0 && <div className="mt-3 flex gap-2">{detail.attachments.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><img alt="Feedback attachment" src={attachment.url} className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200 transition hover:opacity-80 dark:ring-slate-700" /></a>)}</div>}
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800"><label htmlFor="feedback-status" className="text-sm font-semibold">Case status</label><select id="feedback-status" disabled={busy} value={detail.complaint.status} onChange={(event) => void changeStatus(event.target.value)} className="input w-auto min-w-[140px] capitalize">{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
          <div className="my-5 space-y-3">{detail.comments.length === 0 && <p className="py-3 text-center text-sm text-slate-400">No replies yet. Start the conversation below.</p>}{detail.comments.map((comment) => <div key={comment.id} className={`max-w-[88%] rounded-2xl p-3 text-sm shadow-sm ${comment.author_role === "admin" ? "ml-auto rounded-br-sm bg-indigo-600 text-white" : "mr-auto rounded-bl-sm border border-fuchsia-100 bg-fuchsia-50 text-slate-800 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-slate-100"}`}><div className={`flex justify-between gap-5 text-[11px] font-bold uppercase tracking-wider ${comment.author_role === "admin" ? "text-indigo-100" : "text-fuchsia-700 dark:text-fuchsia-300"}`}><span>{comment.author_role === "admin" ? "Admin" : "Student"}</span><span className="font-normal normal-case tracking-normal opacity-75">{new Date(comment.created_at).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap leading-6">{comment.body}</p></div>)}</div>
          {detail.status_history.length > 0 && <div className="border-t border-slate-200 pt-3 dark:border-slate-700"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status history</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{detail.status_history.map((history) => <span key={history.id} className="text-xs text-slate-500">{new Date(history.created_at).toLocaleString()} · <span className="capitalize">{nice(history.status)}</span></span>)}</div></div>}
        </div>
        <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-end gap-2"><div className="flex-1"><textarea value={reply} maxLength={1000} disabled={busy} onChange={(event) => setReply(event.target.value)} className="input min-h-20 w-full resize-y" placeholder="Write a clear reply to the student…" /><div className={`mt-1 text-right text-[11px] ${reply.length >= 1000 ? "font-semibold text-rose-600" : "text-slate-400"}`}>{reply.length} / 1000</div></div><button disabled={busy || !reply.trim() || reply.length > 1000} onClick={() => void send()} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <ButtonLoader /> : "Reply"}</button></div></div>
      </div></div>}
    </div>
  );
}