"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  FileDown,
  FileText,
  GraduationCap,
  Save,
  School,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import { ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";

/* ─── interfaces ─────────────────────────────────────────── */
interface Profile {
  id: string; name: string; father_name: string | null;
  cnic: string | null; contact: string | null; address: string | null;
  email: string | null; profile_image_url: string | null;
  status: string; session: string; department_name: string; class_name: string;
  scheme_of_studies_url: string | null;
}

interface ResultCourse {
  course_code: string; course_title: string; credit_hours: string;
  mid: string; sessional: string; final: string; practical: string;
  total: string; status: string;
}
interface SemesterResult {
  semester_number: number; term_type: string; courses: ResultCourse[];
}

interface CourseAttRow {
  course_id: string; course_title: string; course_code: string;
  teacher_name: string; presents: number; absents: number;
  leaves: number; percentage: number; flag: string;
}
interface SemesterAtt {
  semester_id: string; semester_number: number; term_type: string;
  semester_status: string; courses: CourseAttRow[];
  overall: { presents: number; absents: number; leaves: number; percentage: number; flag: string };
}

interface AttDetail {
  attendance_date: string; status: string;
  reason: string | null; call_remarks: string | null;
}

interface Notification {
  id: string; title: string; message: string; is_read: boolean; created_at: string;
}

interface StudentDsRow {
  course_id: string;
  course_title: string;
  course_code: string;
  credit_hours: string;
  paper_date: string | null;
}

/* ─── helpers ─────────────────────────────────────────────── */
const flagLabel: Record<string, string> = { ok: "OK", warning: "Warning", struck_off: "Struck Off" };
const flagCls: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  struck_off: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};
const statusCls: Record<string, string> = {
  present: "text-emerald-600 dark:text-emerald-400",
  absent: "text-red-600 dark:text-red-400",
  leave: "text-amber-600 dark:text-amber-400",
};

/* ─── tabs ────────────────────────────────────────────────── */
const TABS = [
  { id: "overview",       label: "Overview",       icon: ClipboardList },
  { id: "results",        label: "Results",         icon: GraduationCap },
  { id: "datesheet",      label: "Mid Exam Date Sheet", icon: FileText },
  { id: "attendance",     label: "Attendance",      icon: Activity },
  { id: "notifications",  label: "Notifications",   icon: Bell },
  { id: "profile",        label: "Profile",         icon: User },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ─── component ───────────────────────────────────────────── */
export default function StudentDashboardManager() {
  const [tab, setTab] = useState<TabId>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);

  /* course-wise attendance (overview) */
  const [semAtts, setSemAtts] = useState<SemesterAtt[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [expandedSems, setExpandedSems] = useState<Set<string>>(new Set());

  /* details modal */
  const [modal, setModal] = useState<{
    semesterId: string; courseId: string; courseTitle: string; teacherName: string;
  } | null>(null);
  const [details, setDetails] = useState<AttDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  /* results */
  const [results, setResults] = useState<SemesterResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  /* simple attendance tab */
  const [attFrom, setAttFrom] = useState("");
  const [attTo, setAttTo] = useState("");
  const [attSummary, setAttSummary] = useState<{
    presents: number; absents: number; leaves: number; percentage: number; flag: string;
  } | null>(null);
  const [attRecords, setAttRecords] = useState<{ attendance_date: string; status: string; reason: string | null }[]>([]);
  const [simpleAttLoading, setSimpleAttLoading] = useState(false);

  /* mid exam date sheet */
  const [dsRows, setDsRows] = useState<StudentDsRow[]>([]);
  const [dsLoading, setDsLoading] = useState(false);

  /* notifications */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  /* profile form */
  const [profileForm, setProfileForm] = useState({ contact: "", address: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);

  /* ── loaders ── */
  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/student/profile");
    const data = await res.json();
    if (res.ok) {
      setProfile(data.student);
      setProfileForm({ contact: data.student.contact || "", address: data.student.address || "" });
    }
  }, []);

  const loadCourseAtt = useCallback(async () => {
    setAttLoading(true);
    try {
      const res = await fetch("/api/student/course-attendance");
      const data = await res.json();
      if (res.ok) {
        setSemAtts(data.semesters ?? []);
        // auto-expand all semesters
        setExpandedSems(new Set((data.semesters ?? []).map((s: SemesterAtt) => s.semester_id)));
      }
    } finally {
      setAttLoading(false);
    }
  }, []);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await fetch("/api/student/results");
      const data = await res.json();
      if (res.ok) setResults(data.semesters ?? []);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const loadSimpleAtt = useCallback(async () => {
    setSimpleAttLoading(true);
    try {
      const params = new URLSearchParams();
      if (attFrom) params.set("from", attFrom);
      if (attTo) params.set("to", attTo);
      const res = await fetch(`/api/student/attendance?${params}`);
      const data = await res.json();
      if (res.ok) { setAttSummary(data.summary); setAttRecords(data.records || []); }
    } finally {
      setSimpleAttLoading(false);
    }
  }, [attFrom, attTo]);

  const loadDatesheet = useCallback(async () => {
    setDsLoading(true);
    try {
      const res = await fetch("/api/student/mid-exam-datesheet");
      const data = await res.json();
      if (res.ok) setDsRows(data.rows ?? []);
    } finally {
      setDsLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/student/notifications");
      const data = await res.json();
      if (res.ok) setNotifications(data.notifications);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); loadCourseAtt(); }, [loadProfile, loadCourseAtt]);

  useEffect(() => {
    if (tab === "results")       loadResults();
    if (tab === "datesheet")     loadDatesheet();
    if (tab === "attendance")    loadSimpleAtt();
    if (tab === "notifications") loadNotifications();
  }, [tab, loadResults, loadDatesheet, loadSimpleAtt, loadNotifications]);

  /* details modal open */
  async function openDetails(semesterId: string, courseId: string, courseTitle: string, teacherName: string) {
    setModal({ semesterId, courseId, courseTitle, teacherName });
    setDetails([]);
    setDetailsLoading(true);
    try {
      const res = await fetch(
        `/api/student/course-attendance/details?semester_id=${semesterId}&course_id=${courseId}`
      );
      const data = await res.json();
      if (res.ok) setDetails(data.records ?? []);
    } finally {
      setDetailsLoading(false);
    }
  }

  /* notifications */
  async function markRead(id: string) {
    await fetch("/api/student/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }
  async function markAllRead() {
    await fetch("/api/student/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
  }

  /* profile save */
  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Profile updated.");
      loadProfile();
    } finally { setSaving(false); }
  }
  async function handleChangePassword() {
    if (!passwordForm.new_password) return;
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Password changed.");
      setPasswordForm({ current_password: "", new_password: "" });
    } finally { setSaving(false); }
  }

  const unread = notifications.filter((n) => !n.is_read).length;

  function toggleSem(id: string) {
    setExpandedSems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ── render ── */
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      {/* page header + tab strip */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {profile ? `${profile.class_name} · ${profile.session} · ${profile.department_name}` : "Loading…"}
        </p>
      </div>

      {/* tab navigation */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <t.icon size={15} />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
            {t.id === "notifications" && unread > 0 && (
              <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* stat cards */}
          {profile && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="card-3d card-hover p-6">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/10">
                  <School size={32} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{profile.class_name}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Session: {profile.session}</p>
                {profile.scheme_of_studies_url && (
                  <a
                    href={`/api/admin/classes/${profile.class_id}/scheme`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                  >
                    <FileText size={12} /> View Scheme of Studies
                  </a>
                )}
              </div>

              <div className="card-3d card-hover p-6">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/10">
                  <ShieldCheck size={32} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-bold capitalize text-slate-900 dark:text-white">{profile.status}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enrollment Status</p>
              </div>

              {semAtts.length > 0 && (() => {
                const activeSem = semAtts.find((s) => s.semester_status === "active") ?? semAtts[semAtts.length - 1];
                return (
                  <div className="card-3d card-hover p-6">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/10">
                      <Activity size={32} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {activeSem.overall.percentage}%
                    </p>
                    <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${flagCls[activeSem.overall.flag]}`}>
                      {flagLabel[activeSem.overall.flag]}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      Sem {activeSem.semester_number} Attendance
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* course-wise attendance by semester */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
              Attendance by Course &amp; Semester
            </h2>
            {attLoading ? (
              <DataFetchLoader label="Loading attendance…" />
            ) : semAtts.length === 0 ? (
              <div className="card-3d p-8 text-center text-sm text-slate-400">
                No attendance records found.
              </div>
            ) : (
              <div className="space-y-4">
                {semAtts.map((sem) => {
                  const open = expandedSems.has(sem.semester_id);
                  return (
                    <div key={sem.semester_id} className="card-3d overflow-hidden">
                      {/* semester header — clickable to collapse */}
                      <button
                        onClick={() => toggleSem(sem.semester_id)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left dark:bg-slate-800/60"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen size={18} className="text-indigo-500" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            Semester {sem.semester_number} — {sem.term_type}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            sem.semester_status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                          }`}>
                            {sem.semester_status === "active" ? "Active" : "Closed"}
                          </span>
                        </div>
                        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      </button>

                      {open && (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                              <tr>
                                <th className="px-4 py-3">Course</th>
                                <th className="px-4 py-3">Teacher</th>
                                <th className="px-4 py-3 text-center">Presents</th>
                                <th className="px-4 py-3 text-center">Absents</th>
                                <th className="px-4 py-3 text-center">Leaves</th>
                                <th className="px-4 py-3 text-center">%</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {sem.courses.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                                    No timetable set up for this semester yet.
                                  </td>
                                </tr>
                              ) : (
                                sem.courses.map((c) => (
                                  <tr key={c.course_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</p>
                                      <p className="text-xs text-slate-400">{c.course_code}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.teacher_name}</td>
                                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{c.presents}</td>
                                    <td className="px-4 py-3 text-center font-medium text-red-600 dark:text-red-400">{c.absents}</td>
                                    <td className="px-4 py-3 text-center font-medium text-amber-600 dark:text-amber-400">{c.leaves}</td>
                                    <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                                      {c.percentage}%
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${flagCls[c.flag]}`}>
                                        {flagLabel[c.flag]}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        onClick={() => openDetails(sem.semester_id, c.course_id, c.course_title, c.teacher_name)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                                      >
                                        <Eye size={13} /> Details
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}

                              {/* overall row */}
                              <tr className="bg-indigo-50/60 font-semibold dark:bg-indigo-500/5">
                                <td colSpan={2} className="px-4 py-3 text-slate-700 dark:text-slate-200">
                                  Overall Semester Attendance
                                </td>
                                <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400">{sem.overall.presents}</td>
                                <td className="px-4 py-3 text-center text-red-600 dark:text-red-400">{sem.overall.absents}</td>
                                <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{sem.overall.leaves}</td>
                                <td className="px-4 py-3 text-center text-slate-800 dark:text-white">{sem.overall.percentage}%</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${flagCls[sem.overall.flag]}`}>
                                    {flagLabel[sem.overall.flag]}
                                  </span>
                                </td>
                                <td />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {tab === "results" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Academic Results</h2>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 print:hidden"
            >
              <FileDown size={16} /> Export PDF
            </button>
          </div>
          {resultsLoading ? (
            <DataFetchLoader label="Loading results…" />
          ) : results.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">No results uploaded yet.</div>
          ) : (
            <div className="space-y-6">
              {results.map((sem) => (
                <div key={sem.semester_number} className="card-3d overflow-hidden">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 dark:from-indigo-500/10 dark:to-violet-500/10">
                    <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      Semester {sem.semester_number} — {sem.term_type}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3 text-center">Mid</th>
                          <th className="px-4 py-3 text-center">Sessional</th>
                          <th className="px-4 py-3 text-center">Final</th>
                          <th className="px-4 py-3 text-center">Practical</th>
                          <th className="px-4 py-3 text-center">Total</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sem.courses.map((c) => {
                          const statusColor =
                            c.status === "pass" ? "text-emerald-600 dark:text-emerald-400"
                            : c.status === "fail" ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400";
                          return (
                            <tr key={c.course_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</p>
                                <p className="text-xs text-slate-400">{c.course_code} · {c.credit_hours} cr</p>
                              </td>
                              <td className="px-4 py-3 text-center">{c.mid}</td>
                              <td className="px-4 py-3 text-center">{c.sessional}</td>
                              <td className="px-4 py-3 text-center">{c.final}</td>
                              <td className="px-4 py-3 text-center">{c.practical}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-white">{c.total}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold uppercase ${statusColor}`}>{c.status}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MID EXAM DATE SHEET ── */}
      {tab === "datesheet" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Mid Exam Date Sheet</h2>
            <button
              onClick={loadDatesheet}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
          {dsLoading ? (
            <DataFetchLoader label="Loading date sheet…" />
          ) : dsRows.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">
              No date sheet entries available yet. Check back later.
            </div>
          ) : (
            <div className="overflow-x-auto card-3d shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-800">
                    <th className="px-4 py-2">Course</th>
                    <th className="px-4 py-2 text-center">Cr. Hrs</th>
                    <th className="px-4 py-2">Paper Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dsRows.map((r) => (
                    <tr key={r.course_id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{r.course_title}</div>
                        <div className="text-xs text-slate-400">{r.course_code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center">{r.credit_hours}</td>
                      <td className="px-4 py-2.5">
                        {r.paper_date ? (
                          <span className="font-medium text-indigo-700 dark:text-indigo-400">
                            {formatDateOnly(r.paper_date)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not scheduled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE (simple daily view) ── */}
      {tab === "attendance" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Daily Attendance</h2>
          <div className="card-3d flex flex-wrap items-end gap-4 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">From</label>
              <input type="date" value={attFrom} onChange={(e) => setAttFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">To</label>
              <input type="date" value={attTo} onChange={(e) => setAttTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <button onClick={loadSimpleAtt}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Filter
            </button>
          </div>

          {simpleAttLoading ? <DataFetchLoader label="Loading…" /> : !attSummary ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">No active semester found.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Presents", value: attSummary.presents, cls: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Absents",  value: attSummary.absents,  cls: "text-red-600 dark:text-red-400" },
                  { label: "Leaves",   value: attSummary.leaves,   cls: "text-amber-600 dark:text-amber-400" },
                  { label: "Percentage", value: `${attSummary.percentage}%`, cls: "text-indigo-600 dark:text-indigo-400" },
                ].map((s) => (
                  <div key={s.label} className="card-3d card-hover p-5">
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {attRecords.length > 0 && (
                <div className="card-3d overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {attRecords.map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5">{formatDateOnly(r.attendance_date)}</td>
                            <td className={`px-4 py-2.5 font-medium capitalize ${statusCls[r.status] ?? ""}`}>{r.status}</td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{r.reason || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === "notifications" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Notifications</h2>
            <button onClick={markAllRead} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
              Mark all as read
            </button>
          </div>
          {notifLoading ? <DataFetchLoader label="Loading…" /> : notifications.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <button key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                className={`block w-full rounded-xl border p-4 text-left transition-colors ${
                  n.is_read
                    ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40"
                    : "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10"
                }`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateOnly(n.created_at)}</p>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── PROFILE ── */}
      {tab === "profile" && profile && (
        <div className="space-y-6">
          <div className="card-3d p-6">
            <h2 className="mb-5 text-base font-semibold text-slate-800 dark:text-slate-100">Personal Information</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                { label: "Full Name",   value: profile.name },
                { label: "Father Name", value: profile.father_name || "—" },
                { label: "CNIC",        value: profile.cnic || "—" },
                { label: "Email",       value: profile.email || "—" },
                { label: "Department",  value: profile.department_name },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-xs font-medium uppercase text-slate-500">{f.label}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100">{f.value}</p>
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Contact</label>
                <input type="text" value={profileForm.contact}
                  onChange={(e) => setProfileForm((p) => ({ ...p, contact: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Address</label>
                <input type="text" value={profileForm.address}
                  onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <ButtonLoader /> : <Save size={16} />} Save Profile
              </button>
            </div>
          </div>

          <div className="card-3d p-6">
            <h2 className="mb-5 text-base font-semibold text-slate-800 dark:text-slate-100">Change Password</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Current Password</label>
                <input type="password" value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">New Password</label>
                <input type="password" value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={handleChangePassword} disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAILS MODAL ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="card-3d w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* modal header */}
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-700">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{modal.courseTitle}</h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{modal.teacherName} — Date-wise Attendance</p>
              </div>
              <button onClick={() => setModal(null)}
                className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* modal body */}
            <div className="flex-1 overflow-y-auto">
              {detailsLoading ? (
                <div className="p-8"><DataFetchLoader label="Loading records…" /></div>
              ) : details.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  No attendance records found for this course.<br />
                  <span className="text-xs">Records appear only on days this course is scheduled in the timetable.</span>
                </p>
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {details.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5">{formatDateOnly(d.attendance_date)}</td>
                        <td className={`px-4 py-2.5 font-medium capitalize ${statusCls[d.status] ?? ""}`}>{d.status}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{d.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{d.call_remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
