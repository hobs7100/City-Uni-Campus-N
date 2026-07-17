"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bell, Send, Inbox, Filter, Users } from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import { ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RichTextViewer from "@/components/ui/RichTextViewer";

/* ─── types ──────────────────────────────────────────────────────────────── */
interface Department { id: string; name: string }
interface ClassRow   { id: string; class_name: string; session: string; department_id: string }
interface Broadcast  {
  id: string; subject: string; body: string;
  notification_date: string; created_at: string;
  department_name: string | null; class_name: string | null;
  session: string | null; recipient_count: number;
  created_by_name: string | null;
}

const TABS = [
  { id: "new",  label: "New Notification", icon: Send  },
  { id: "all",  label: "All Notifications", icon: Inbox },
] as const;
type TabId = (typeof TABS)[number]["id"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Strip HTML tags and return plain text to test if body is empty */
function htmlHasContent(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

/* ─── component ───────────────────────────────────────────────────────────── */
export default function AdminNotificationsManager() {
  const [tab, setTab] = useState<TabId>("new");

  /* shared catalog */
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allClasses,  setAllClasses]  = useState<ClassRow[]>([]);

  /* ── new-notification form ──────────────────────────────────────────────── */
  const [fDept,    setFDept]    = useState("");
  const [fSession, setFSession] = useState("");
  const [fClass,   setFClass]   = useState("");
  const [fDate,    setFDate]    = useState(today());
  const [fSubject, setFSubject] = useState("");
  const [fBody,    setFBody]    = useState("");      // HTML string from editor
  const [posting,  setPosting]  = useState(false);

  /* ── all-notifications filters ─────────────────────────────────────────── */
  const [filterDept,    setFilterDept]    = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterClass,   setFilterClass]   = useState("");
  const [broadcasts,    setBroadcasts]    = useState<Broadcast[]>([]);
  const [listLoading,   setListLoading]   = useState(false);

  /* ── load catalog ───────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments ?? []));
  }, []);

  /* load classes when dept changes (form) */
  useEffect(() => {
    setFSession(""); setFClass(""); setAllClasses([]);
    if (!fDept) return;
    fetch(`/api/admin/classes?department_id=${fDept}`)
      .then((r) => r.json())
      .then((d) => setAllClasses(d.classes ?? []));
  }, [fDept]);

  /* ── derived cascades (form) ────────────────────────────────────────────── */
  const formSessions = useMemo(
    () => [...new Set(allClasses.map((c) => c.session))].sort().reverse(),
    [allClasses]
  );
  const formClasses = useMemo(
    () => (fSession ? allClasses.filter((c) => c.session === fSession) : allClasses),
    [allClasses, fSession]
  );

  /* classes for filter panel (based on filterDept) */
  const [filterClasses, setFilterClasses] = useState<ClassRow[]>([]);
  useEffect(() => {
    setFilterSession(""); setFilterClass(""); setFilterClasses([]);
    if (!filterDept) return;
    fetch(`/api/admin/classes?department_id=${filterDept}`)
      .then((r) => r.json())
      .then((d) => setFilterClasses(d.classes ?? []));
  }, [filterDept]);

  const filterSessions = useMemo(
    () => [...new Set(filterClasses.map((c) => c.session))].sort().reverse(),
    [filterClasses]
  );
  const filteredClassList = useMemo(
    () => (filterSession ? filterClasses.filter((c) => c.session === filterSession) : filterClasses),
    [filterClasses, filterSession]
  );

  /* ── load broadcasts ────────────────────────────────────────────────────── */
  const loadBroadcasts = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDept)    params.set("department_id", filterDept);
      if (filterSession) params.set("session",       filterSession);
      if (filterClass)   params.set("class_id",      filterClass);
      const res  = await fetch(`/api/admin/notifications?${params}`);
      const data = await res.json();
      if (res.ok) setBroadcasts(data.broadcasts ?? []);
    } finally {
      setListLoading(false);
    }
  }, [filterDept, filterSession, filterClass]);

  useEffect(() => {
    if (tab === "all") loadBroadcasts();
  }, [tab, loadBroadcasts]);

  /* ── post notification ──────────────────────────────────────────────────── */
  async function handlePost() {
    if (!fDept)               { toast.error("Please select a department."); return; }
    if (!fDate)               { toast.error("Please select a date."); return; }
    if (!fSubject.trim())     { toast.error("Subject / Purpose is required."); return; }
    if (!htmlHasContent(fBody)) { toast.error("Body of notification is required."); return; }

    setPosting(true);
    try {
      const res  = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id:     fDept,
          class_id:          fClass   || null,
          session:           fSession || null,
          notification_date: fDate,
          subject:           fSubject.trim(),
          body:              fBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to post notification."); return; }
      toast.success(`Notification posted to ${data.recipient_count} recipient(s).`);
      /* reset form */
      setFDept(""); setFSession(""); setFClass("");
      setFDate(today()); setFSubject(""); setFBody("");
    } finally {
      setPosting(false);
    }
  }

  function classLabel(cls: ClassRow) {
    return `${cls.class_name} (${cls.session})`;
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      {/* header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow">
          <Bell size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Post announcements to students, teachers, and HODs
          </p>
        </div>
      </div>

      {/* tab strip */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ NEW NOTIFICATION TAB ════════════════════════════ */}
      {tab === "new" && (
        <div className="mx-auto max-w-4xl">
          <div className="card-3d p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Compose Notification
            </h2>

            {/* Row 1: Dept / Session / Class */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={fDept}
                  onChange={(e) => setFDept(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">— Select —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Session <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <select
                  value={fSession}
                  onChange={(e) => { setFSession(e.target.value); setFClass(""); }}
                  disabled={!fDept}
                  className="input-base w-full disabled:opacity-50"
                >
                  <option value="">— All Sessions —</option>
                  {formSessions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Class <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <select
                  value={fClass}
                  onChange={(e) => setFClass(e.target.value)}
                  disabled={!fDept}
                  className="input-base w-full disabled:opacity-50"
                >
                  <option value="">— All Classes —</option>
                  {formClasses.map((c) => (
                    <option key={c.id} value={c.id}>{classLabel(c)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Date / Subject */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  className="input-base w-full"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Subject / Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fSubject}
                  onChange={(e) => setFSubject(e.target.value)}
                  placeholder="e.g. Mid Term Exam Schedule"
                  className="input-base w-full"
                />
              </div>
            </div>

            {/* Body — rich text editor */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Body of Notification <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={fBody}
                onChange={setFBody}
                placeholder="Write the full notification message here…"
                minHeight={240}
              />
            </div>

            {/* Recipient preview */}
            {fDept && (
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2.5 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Users size={15} />
                <span>
                  Sending to{" "}
                  <strong>
                    {fClass
                      ? `students & teachers of ${formClasses.find((c) => c.id === fClass)?.class_name ?? "selected class"}`
                      : fSession
                      ? `all classes in session ${fSession}`
                      : `entire department`}
                  </strong>
                  {" "}+ department HOD
                </span>
              </div>
            )}

            {/* Post button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handlePost}
                disabled={posting}
                className="btn-primary flex items-center gap-2 px-6 py-2.5"
              >
                {posting ? <ButtonLoader /> : <Send size={15} />}
                {posting ? "Posting…" : "Post Notification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ ALL NOTIFICATIONS TAB ═══════════════════════════ */}
      {tab === "all" && (
        <div className="space-y-4">
          {/* filters */}
          <div className="card-3d p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Filter size={14} /> Filters
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Department</label>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Session</label>
                <select
                  value={filterSession}
                  onChange={(e) => { setFilterSession(e.target.value); setFilterClass(""); }}
                  disabled={!filterDept}
                  className="input-base w-full disabled:opacity-50"
                >
                  <option value="">All Sessions</option>
                  {filterSessions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Class</label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  disabled={!filterDept}
                  className="input-base w-full disabled:opacity-50"
                >
                  <option value="">All Classes</option>
                  {filteredClassList.map((c) => (
                    <option key={c.id} value={c.id}>{classLabel(c)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={loadBroadcasts}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
              >
                <Filter size={13} /> Apply Filters
              </button>
            </div>
          </div>

          {/* results */}
          {listLoading ? (
            <DataFetchLoader label="Loading notifications…" />
          ) : broadcasts.length === 0 ? (
            <div className="card-3d p-12 text-center">
              <Bell size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400">No notifications found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <div key={b.id} className="card-3d p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{b.subject}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {b.department_name && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                            {b.department_name}
                          </span>
                        )}
                        {b.class_name && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                            {b.class_name}
                          </span>
                        )}
                        {b.session && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            {b.session}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Users size={12} />
                        <span>{b.recipient_count} recipients</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatDateOnly(b.notification_date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                    <RichTextViewer html={b.body} />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400">
                      Posted by {b.created_by_name ?? "—"} · {formatDateOnly(b.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
