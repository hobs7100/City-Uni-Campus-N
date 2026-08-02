"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, UserX, ClipboardList, Upload, X, Image as ImageIcon,
  Calendar, FileText, Eye, Pencil, RotateCcw, CheckCircle2, AlertTriangle,
  ChevronDown, User, Building2, BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";
import { formatDateOnly } from "@/lib/format";

/* ── types ───────────────────────────────────────────────────────────────── */
interface StudentResult {
  id: string;
  name: string;
  father_name: string | null;
  cnic: string;
  class_name: string;
  session: string;
  department_name: string;
  status: string;
}

interface LeaveRecord {
  id: string;
  student_id: string;
  student_name: string;
  father_name: string | null;
  cnic: string;
  contact?: string | null;
  class_name: string;
  session: string;
  department_name: string;
  issue_date: string;
  reason: string | null;
  notes: string | null;
  proof_urls: string[];
  issued_by_name: string | null;
  revoked_at: string | null;
  created_at: string;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function statusBadge(status: string) {
  const map: Record<string, string> = {
    active:           "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    struck_off:       "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    left:             "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    dropped:          "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    freezed:          "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
    permanent_leave:  "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  };
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-slate-100 text-slate-500"}`}>
      {label}
    </span>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFile(base64: string): Promise<string> {
  const res = await fetch("/api/upload", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ file: base64, folder: "leave-proofs" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

/* ── proof thumbnail ─────────────────────────────────────────────────────── */
function ProofThumb({ url, onRemove }: { url: string; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="group relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Proof" className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => setOpen(true)} className="rounded-full bg-white/90 p-1.5 text-slate-700 hover:bg-white">
            <Eye size={13} />
          </button>
          {onRemove && (
            <button onClick={onRemove} className="rounded-full bg-white/90 p-1.5 text-red-600 hover:bg-white">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Proof"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(false)}
            className="absolute right-5 top-5 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */
export default function LeaveManagementManager() {
  const [tab, setTab] = useState<"issue" | "all">("issue");

  /* ── issue-leave tab state ── */
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [selected,      setSelected]      = useState<StudentResult | null>(null);

  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason,    setReason]    = useState("");
  const [notes,     setNotes]     = useState("");

  const [proofPreviews, setProofPreviews] = useState<string[]>([]);   // base64 data URLs
  const [proofFiles,    setProofFiles]    = useState<File[]>([]);
  const [submitting,    setSubmitting]    = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef    = useRef<HTMLDivElement>(null);

  /* ── all-leaves tab state ── */
  const [leaves,            setLeaves]            = useState<LeaveRecord[]>([]);
  const [leavesLoading,     setLeavesLoading]     = useState(false);
  const [leavesFetched,     setLeavesFetched]     = useState(false);
  const [selected2,         setSelected2]         = useState<LeaveRecord | null>(null);
  const [editMode,          setEditMode]          = useState(false);
  const [allLeavesSearch,   setAllLeavesSearch]   = useState("");

  const filteredLeaves = useMemo(() => {
    const q = allLeavesSearch.trim().toLowerCase();
    if (!q) return leaves;
    return leaves.filter(
      (l) =>
        l.student_name.toLowerCase().includes(q) ||
        (l.father_name ?? "").toLowerCase().includes(q) ||
        l.class_name.toLowerCase().includes(q) ||
        l.session.toLowerCase().includes(q),
    );
  }, [leaves, allLeavesSearch]);

  // edit form state (populated when editMode=true)
  const [editDate,       setEditDate]       = useState("");
  const [editReason,     setEditReason]     = useState("");
  const [editNotes,      setEditNotes]      = useState("");
  const [editProofPrev,  setEditProofPrev]  = useState<string[]>([]);
  const [editProofNew,   setEditProofNew]   = useState<File[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [revoking,       setRevoking]       = useState(false);
  const [confirmRevoke,  setConfirmRevoke]  = useState(false);

  const editFileRef = useRef<HTMLInputElement>(null);

  /* ── search students ── */
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/admin/leave-management/students?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.students ?? []);
        setShowDropdown(true);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* ── close dropdown on outside click ── */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* ── load all leaves ── */
  const loadLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const res  = await fetch("/api/admin/leave-management");
      const data = await res.json();
      if (res.ok) { setLeaves(data.leaves ?? []); setLeavesFetched(true); }
    } finally { setLeavesLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "all" && !leavesFetched) loadLeaves();
  }, [tab, leavesFetched, loadLeaves]);

  /* ── proof image selection ── */
  function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 3 - proofFiles.length;
    const toAdd = files.slice(0, remaining);
    toAdd.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setProofPreviews((p) => [...p, reader.result as string]);
        setProofFiles((p)    => [...p, f]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  function removeProof(idx: number) {
    setProofPreviews((p) => p.filter((_, i) => i !== idx));
    setProofFiles((p)    => p.filter((_, i) => i !== idx));
  }

  /* ── submit issue leave ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) { toast.error("Select a student first."); return; }
    if (!issueDate) { toast.error("Issue date is required."); return; }

    setSubmitting(true);
    try {
      // Upload proof images first
      const proofUrls: string[] = [];
      for (let i = 0; i < proofFiles.length; i++) {
        const b64 = proofPreviews[i];
        const url = await uploadFile(b64);
        proofUrls.push(url);
      }

      const res  = await fetch("/api/admin/leave-management", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selected.id,
          issue_date: issueDate,
          reason:     reason || null,
          notes:      notes  || null,
          proof_urls: proofUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to issue leave."); return; }

      toast.success(`Permanent leave issued for ${selected.name}.`);
      // Reset form
      setSelected(null); setSearchQuery("");
      setIssueDate(new Date().toISOString().slice(0, 10));
      setReason(""); setNotes("");
      setProofFiles([]); setProofPreviews([]);
      setLeavesFetched(false); // force refresh of all-leaves
    } finally { setSubmitting(false); }
  }

  /* ── open detail modal ── */
  function openDetail(leave: LeaveRecord) {
    setSelected2(leave);
    setEditMode(false);
    setConfirmRevoke(false);
  }

  function enterEditMode() {
    if (!selected2) return;
    setEditDate(selected2.issue_date);
    setEditReason(selected2.reason ?? "");
    setEditNotes(selected2.notes ?? "");
    setEditProofPrev(selected2.proof_urls ?? []);
    setEditProofNew([]);
    setEditMode(true);
  }

  function handleEditProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 3 - editProofPrev.length;
    const toAdd = files.slice(0, remaining);
    toAdd.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setEditProofNew((p) => [...p, f]);
        setEditProofPrev((p) => [...p, reader.result as string]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  async function handleSaveEdit() {
    if (!selected2) return;
    setSaving(true);
    try {
      // Upload any new files
      const finalUrls: string[] = [];
      let newIdx = 0;
      for (const url of editProofPrev) {
        if (url.startsWith("data:")) {
          // It's a local preview — upload it
          const uploaded = await uploadFile(url);
          finalUrls.push(uploaded);
          newIdx++;
        } else {
          finalUrls.push(url); // already a remote URL
        }
      }
      void newIdx;

      const res  = await fetch(`/api/admin/leave-management/${selected2.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_date:  editDate,
          reason:      editReason || null,
          notes:       editNotes  || null,
          proof_urls:  finalUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to save."); return; }
      toast.success("Leave updated.");
      setEditMode(false);
      setLeavesFetched(false);
      await loadLeaves();
      // Refresh selected2
      const updated = leaves.find((l) => l.id === selected2.id);
      if (updated) {
        setSelected2({
          ...updated,
          issue_date: editDate,
          reason:     editReason || null,
          notes:      editNotes  || null,
          proof_urls: finalUrls,
        });
      }
    } finally { setSaving(false); }
  }

  async function handleRevoke() {
    if (!selected2) return;
    setRevoking(true);
    try {
      const res  = await fetch(`/api/admin/leave-management/${selected2.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoke: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to revoke."); return; }
      toast.success("Leave revoked. Student restored to active.");
      setSelected2(null);
      setLeavesFetched(false);
      loadLeaves();
    } finally { setRevoking(false); setConfirmRevoke(false); }
  }

  const tabs = [
    { id: "issue", label: "Issue Leave",  icon: UserX },
    { id: "all",   label: "All Leaves",   icon: ClipboardList },
  ] as const;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ── page header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl grad-primary shadow-lg shadow-indigo-500/25">
          <UserX size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Leave Management</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Issue and manage permanent student leaves</p>
        </div>
      </div>

      {/* ── tab bar ── */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              tab === id
                ? "grad-primary text-white shadow-md shadow-indigo-500/20"
                : "text-slate-600 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ TAB 1: ISSUE LEAVE ═══════════════════════ */}
      {tab === "issue" && (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Student search */}
          <div className="card-3d rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <User size={15} className="text-indigo-500" /> Select Student
            </h2>

            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelected(null); }}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Search by name, CNIC, or father's name…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm
                    focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20
                    dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <ButtonLoader />
                  </div>
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {searchResults.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setSelected(s);
                        setSearchQuery(s.name);
                        setShowDropdown(false);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                        <User size={14} className="text-indigo-600 dark:text-indigo-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{s.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {s.father_name ? `S/O ${s.father_name} · ` : ""}{s.class_name} ({s.session})
                        </p>
                        <p className="text-xs text-slate-400">{s.department_name}</p>
                      </div>
                      {statusBadge(s.status)}
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  No students found.
                </div>
              )}
            </div>

            {/* Selected student card */}
            {selected && (
              <div className={`flex items-start gap-4 rounded-xl border-2 p-4 ${
                selected.status === "permanent_leave"
                  ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/5"
                  : "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/5"
              }`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                  <User size={18} className="text-indigo-600 dark:text-indigo-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{selected.name}</p>
                    {statusBadge(selected.status)}
                  </div>
                  {selected.father_name && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">S/O {selected.father_name}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selected.class_name} ({selected.session}) · {selected.department_name}
                  </p>
                  <p className="text-xs text-slate-400">CNIC: {selected.cnic}</p>
                </div>
                <button type="button" onClick={() => { setSelected(null); setSearchQuery(""); }} className="text-slate-400 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
            )}

            {selected?.status === "permanent_leave" && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle size={15} />
                This student already has an active permanent leave. Submitting again will fail.
              </div>
            )}
          </div>

          {/* Leave details */}
          <div className="card-3d rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <FileText size={15} className="text-indigo-500" /> Leave Details
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Date of Issue <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                    focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20
                    dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Reason</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for permanent leave…"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                  focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20
                  dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Notes (internal)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any internal notes…"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                  focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20
                  dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Proof upload */}
          <div className="card-3d rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ImageIcon size={15} className="text-indigo-500" /> Proof Documents
              <span className="ml-auto text-xs font-normal text-slate-400">{proofFiles.length}/3 images</span>
            </h2>

            <div className="flex flex-wrap gap-3">
              {proofPreviews.map((src, i) => (
                <ProofThumb key={i} url={src} onRemove={() => removeProof(i)} />
              ))}
              {proofFiles.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed
                    border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700"
                >
                  <Upload size={18} />
                  <span className="text-[10px]">Add</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleProofSelect}
            />
            <p className="text-[11px] text-slate-400">Accepted: JPG, PNG, WEBP — up to 3 images.</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !selected}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white
                hover:bg-amber-600 disabled:opacity-50 shadow-lg shadow-amber-500/25"
            >
              {submitting ? <ButtonLoader /> : <UserX size={15} />}
              {submitting ? "Issuing Leave…" : "Issue Permanent Leave"}
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════ TAB 2: ALL LEAVES ═══════════════════════ */}
      {tab === "all" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredLeaves.length !== leaves.length
                ? `${filteredLeaves.length} of ${leaves.length} leave records`
                : `${leaves.length} leave record${leaves.length !== 1 ? "s" : ""} total`}
            </p>
            <button
              onClick={() => { setLeavesFetched(false); loadLeaves(); }}
              disabled={leavesLoading}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium
                text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <RotateCcw size={12} className={leavesLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {/* Student name search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={allLeavesSearch}
              onChange={(e) => setAllLeavesSearch(e.target.value)}
              placeholder="Search by student name, class or session…"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {leavesLoading && <DataFetchLoader />}

          {!leavesLoading && leavesFetched && leaves.length === 0 && (
            <div className="card-3d flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
              <UserX size={40} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500">No leave records yet.</p>
            </div>
          )}

          {!leavesLoading && filteredLeaves.length === 0 && leavesFetched && leaves.length > 0 && (
            <div className="card-3d flex flex-col items-center gap-3 rounded-2xl py-12 text-center">
              <Search size={36} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500">No leave records match &ldquo;{allLeavesSearch}&rdquo;.</p>
            </div>
          )}

          {!leavesLoading && filteredLeaves.length > 0 && (
            <div className="card-3d overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">Class / Session</th>
                      <th className="px-4 py-3 text-left">Issue Date</th>
                      <th className="px-4 py-3 text-left">Proofs</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLeaves.map((l, idx) => (
                      <tr
                        key={l.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          l.revoked_at ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{l.student_name}</p>
                          {l.father_name && (
                            <p className="text-xs text-slate-400">S/O {l.father_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <p>{l.class_name}</p>
                          <p className="text-xs text-slate-400">{l.session} · {l.department_name}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {formatDateOnly(l.issue_date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex -space-x-2">
                            {(l.proof_urls ?? []).slice(0, 3).map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={url}
                                alt="proof"
                                className="h-8 w-8 rounded-full border-2 border-white object-cover dark:border-slate-900"
                              />
                            ))}
                            {(l.proof_urls ?? []).length === 0 && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {l.revoked_at ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700">
                              Revoked
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openDetail(l)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium
                              text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700
                              dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ DETAIL MODAL ═══════════════════════════ */}
      {selected2 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected2(null)}>
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Leave Details</h2>
              <button onClick={() => setSelected2(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* student info */}
              <div className="flex items-start gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                  <User size={18} className="text-indigo-600 dark:text-indigo-300" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{selected2.student_name}</p>
                  {selected2.father_name && <p className="text-xs text-slate-500">S/O {selected2.father_name}</p>}
                  <p className="text-xs text-slate-500">{selected2.class_name} ({selected2.session})</p>
                  <p className="text-xs text-slate-400">{selected2.department_name} · {selected2.cnic}</p>
                </div>
              </div>

              {!editMode ? (
                <>
                  {/* view mode */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400">Issue Date</p>
                      <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-100">
                        {formatDateOnly(selected2.issue_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400">Status</p>
                      <p className="mt-0.5">
                        {selected2.revoked_at ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700">
                            Revoked {formatDateOnly(selected2.revoked_at)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            Active
                          </span>
                        )}
                      </p>
                    </div>
                    {selected2.issued_by_name && (
                      <div>
                        <p className="text-xs font-medium uppercase text-slate-400">Issued By</p>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300">{selected2.issued_by_name}</p>
                      </div>
                    )}
                  </div>

                  {selected2.reason && (
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400">Reason</p>
                      <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {selected2.reason}
                      </p>
                    </div>
                  )}
                  {selected2.notes && (
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400">Notes</p>
                      <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {selected2.notes}
                      </p>
                    </div>
                  )}

                  {/* proof images */}
                  {(selected2.proof_urls ?? []).length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-slate-400">Proof Images</p>
                      <div className="flex flex-wrap gap-3">
                        {selected2.proof_urls.map((url, i) => (
                          <ProofThumb key={i} url={url} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* actions */}
                  {!selected2.revoked_at && (
                    <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={enterEditMode}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium
                          text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      {!confirmRevoke ? (
                        <button
                          onClick={() => setConfirmRevoke(true)}
                          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium
                            text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-400"
                        >
                          <RotateCcw size={14} /> Revoke Leave
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm dark:bg-red-500/10">
                          <span className="text-red-600 dark:text-red-400">Restore student to active?</span>
                          <button
                            onClick={handleRevoke}
                            disabled={revoking}
                            className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {revoking ? <ButtonLoader /> : <CheckCircle2 size={12} />} Yes
                          </button>
                          <button onClick={() => setConfirmRevoke(false)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* edit mode */
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Issue Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                        focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Reason</label>
                    <textarea
                      rows={3} value={editReason} onChange={(e) => setEditReason(e.target.value)}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                        focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Notes</label>
                    <textarea
                      rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                        focus:border-indigo-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* proof images edit */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-medium uppercase text-slate-500">Proof Images</label>
                      <span className="text-xs text-slate-400">{editProofPrev.length}/3</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {editProofPrev.map((url, i) => (
                        <ProofThumb
                          key={i}
                          url={url}
                          onRemove={() => {
                            setEditProofPrev((p) => p.filter((_, j) => j !== i));
                            setEditProofNew((p) => p.filter((_, j) => j !== i));
                          }}
                        />
                      ))}
                      {editProofPrev.length < 3 && (
                        <button
                          type="button"
                          onClick={() => editFileRef.current?.click()}
                          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed
                            border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700"
                        >
                          <Upload size={18} /><span className="text-[10px]">Add</span>
                        </button>
                      )}
                    </div>
                    <input
                      ref={editFileRef}
                      type="file" accept="image/*" multiple
                      className="hidden"
                      onChange={handleEditProofSelect}
                    />
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? <ButtonLoader /> : <CheckCircle2 size={14} />} Save
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
