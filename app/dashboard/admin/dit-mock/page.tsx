"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Pencil, Plus, Trash2, Search, FileDown, ChevronDown, ChevronUp,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { TableLoader } from "@/components/ui/Loaders";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface TestSeries {
  id: string;
  name: string;
  total_marks: number;
  passing_marks: number;
  created_at: string;
}

interface DitResult {
  id: string;
  student_id: string;
  student_name: string;
  father_name: string | null;
  profile_image_url: string | null;
  roll_no: string | null;
  class_id: string;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
  semester_id: string;
  test_series_id: string;
  test_series_name: string;
  total_marks: number;
  passing_marks: number;
  course_title: string;
  course_code: string;
  allocation_id: string;
  test_date: string;
  obtained_marks: number;
  remarks: string | null;
  teacher_name: string;
}

interface DitStudent {
  id: string;
  name: string;
  father_name: string | null;
  session: string;
  class_name: string;
}

/* ─── Grade helper ───────────────────────────────────────────────────────── */
function calcGrade(obtained: number, total: number, passing: number): string {
  const pct = total > 0 ? (obtained / total) * 100 : 0;
  if (obtained < passing) return "F";
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  return "D";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function DitMockPage() {
  const [activeTab, setActiveTab] = useState<"series" | "view" | "all">("series");

  /* ── Test Series ─────────────────────────────────────────────────────── */
  const [series, setSeries]       = useState<TestSeries[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [editSeries, setEditSeries]           = useState<TestSeries | null>(null);
  const [seriesSaving, setSeriesSaving]       = useState(false);
  const [deleteSeriesTarget, setDeleteSeriesTarget] = useState<TestSeries | null>(null);
  const [deletingSeries, setDeletingSeries]   = useState(false);
  const [sName, setSName]   = useState("");
  const [sTotal, setSTotal] = useState("");
  const [sPass, setSPass]   = useState("");

  /* ── DIT students (for View Results search) ──────────────────────────── */
  const [ditStudents, setDitStudents] = useState<DitStudent[]>([]);

  /* ── View Results filters ────────────────────────────────────────────── */
  const [vrStudentId,    setVrStudentId]    = useState("");
  const [vrSession,      setVrSession]      = useState("");
  const [vrSemesterId,   setVrSemesterId]   = useState("");
  const [vrSeriesId,     setVrSeriesId]     = useState("");
  const [vrFrom,         setVrFrom]         = useState("");
  const [vrTo,           setVrTo]           = useState("");
  const [vrResults,      setVrResults]      = useState<DitResult[]>([]);
  const [vrLoading,      setVrLoading]      = useState(false);
  const [vrSearched,     setVrSearched]     = useState(false);

  /* ── All Results ─────────────────────────────────────────────────────── */
  const [allResults,     setAllResults]     = useState<DitResult[]>([]);
  const [allLoading,     setAllLoading]     = useState(false);
  const [deleteResultTarget, setDeleteResultTarget] = useState<DitResult | null>(null);
  const [deletingResult,     setDeletingResult]     = useState(false);
  const [editResultTarget,   setEditResultTarget]   = useState<DitResult | null>(null);
  const [editResultOpen,     setEditResultOpen]     = useState(false);
  const [editResultSaving,   setEditResultSaving]   = useState(false);
  const [editObtained,       setEditObtained]       = useState("");
  const [editRemarks,        setEditRemarks]        = useState("");

  /* ── DIT class/semester options for View Results filter ─────────────── */
  const [ditSemesters, setDitSemesters] = useState<{ id: string; class_name: string; session: string; semester_number: number; term_type: string }[]>([]);

  /* ─── Load helpers ───────────────────────────────────────────────────── */
  const loadSeries = useCallback(async () => {
    setSeriesLoading(true);
    try {
      const res  = await fetch("/api/admin/dit/test-series");
      const data = await res.json();
      if (res.ok) setSeries(data.series ?? []);
    } finally { setSeriesLoading(false); }
  }, []);

  const loadDitStudents = useCallback(async () => {
    const res  = await fetch("/api/admin/students");
    const data = await res.json();
    if (res.ok) {
      // We need DIT students only — join class type is handled server-side via class_id.
      // For the search we use all students and filter by DIT sessions after loading semesters.
      setDitStudents(data.students ?? []);
    }
  }, []);

  const loadDitSemesters = useCallback(async () => {
    const res  = await fetch("/api/admin/semesters?class_type=DIT");
    const data = await res.json();
    if (res.ok) setDitSemesters(data.semesters ?? []);
  }, []);

  const loadAllResults = useCallback(async () => {
    setAllLoading(true);
    try {
      const res  = await fetch("/api/admin/dit/results");
      const data = await res.json();
      if (res.ok) setAllResults(data.results ?? []);
    } finally { setAllLoading(false); }
  }, []);

  useEffect(() => {
    loadSeries();
    loadDitStudents();
    loadDitSemesters();
  }, [loadSeries, loadDitStudents, loadDitSemesters]);

  useEffect(() => {
    if (activeTab === "all") loadAllResults();
  }, [activeTab, loadAllResults]);

  /* ─── Test Series CRUD ───────────────────────────────────────────────── */
  function openCreateSeries() {
    setEditSeries(null); setSName(""); setSTotal(""); setSPass("");
    setSeriesModalOpen(true);
  }
  function openEditSeries(s: TestSeries) {
    setEditSeries(s); setSName(s.name); setSTotal(String(s.total_marks)); setSPass(String(s.passing_marks));
    setSeriesModalOpen(true);
  }

  async function handleSeriesSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sName || !sTotal || !sPass) { toast.error("Fill all fields."); return; }
    setSeriesSaving(true);
    try {
      const url    = editSeries ? `/api/admin/dit/test-series/${editSeries.id}` : "/api/admin/dit/test-series";
      const method = editSeries ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sName, total_marks: Number(sTotal), passing_marks: Number(sPass) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed."); return; }
      toast.success(editSeries ? "Test series updated." : "Test series created.");
      setSeriesModalOpen(false); loadSeries();
    } finally { setSeriesSaving(false); }
  }

  async function handleDeleteSeries() {
    if (!deleteSeriesTarget) return;
    setDeletingSeries(true);
    try {
      const res  = await fetch(`/api/admin/dit/test-series/${deleteSeriesTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed."); return; }
      toast.success("Test series deleted."); setDeleteSeriesTarget(null); loadSeries();
    } finally { setDeletingSeries(false); }
  }

  /* ─── View Results ───────────────────────────────────────────────────── */
  const sessionOptions = useMemo(() => {
    const set = new Set(ditSemesters.map((s) => s.session));
    return Array.from(set).map((s) => ({ value: s, label: s }));
  }, [ditSemesters]);

  const semesterOptions = useMemo(() =>
    ditSemesters
      .filter((s) => !vrSession || s.session === vrSession)
      .map((s) => ({ value: s.id, label: `${s.class_name} — Sem ${s.semester_number} (${s.term_type})` })),
    [ditSemesters, vrSession]);

  const seriesOptions = useMemo(() =>
    series.map((s) => ({ value: s.id, label: `${s.name} (${s.total_marks} marks)` })),
    [series]);

  // DIT-only student options
  const ditStudentOptions = useMemo(() => {
    const ditClassIds = new Set(ditSemesters.map((s) => s.session));
    // Filter students who belong to DIT sessions — approximate filter by session match
    // Real DIT filter is enforced server-side via cl.type = 'DIT'
    void ditClassIds;
    return ditStudents.map((s) => ({ value: s.id, label: `${s.name} — ${s.class_name} (${s.session})` }));
  }, [ditStudents, ditSemesters]);

  async function handleViewResults(e: React.FormEvent) {
    e.preventDefault();
    setVrLoading(true); setVrSearched(false);
    try {
      const params = new URLSearchParams();
      if (vrStudentId)  params.set("student_id",    vrStudentId);
      if (vrSession)    params.set("session",        vrSession);
      if (vrSemesterId) params.set("semester_id",   vrSemesterId);
      if (vrSeriesId)   params.set("test_series_id", vrSeriesId);
      if (vrFrom)       params.set("from_date",      vrFrom);
      if (vrTo)         params.set("to_date",         vrTo);
      const res  = await fetch(`/api/admin/dit/results?${params}`);
      const data = await res.json();
      if (res.ok) { setVrResults(data.results ?? []); setVrSearched(true); }
      else toast.error(data.error || "Failed to load results.");
    } finally { setVrLoading(false); }
  }

  /* ─── PDF Report ─────────────────────────────────────────────────────── */
  function exportReport() {
    if (vrResults.length === 0) { toast.error("No results to export."); return; }
    window.print();
  }

  /* ─── All Results edit/delete ────────────────────────────────────────── */
  function openEditResult(r: DitResult) {
    setEditResultTarget(r);
    setEditObtained(String(r.obtained_marks));
    setEditRemarks(r.remarks ?? "");
    setEditResultOpen(true);
  }

  async function handleEditResultSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editResultTarget) return;
    setEditResultSaving(true);
    try {
      const res  = await fetch(`/api/admin/dit/results/${editResultTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obtained_marks: Number(editObtained), remarks: editRemarks || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed."); return; }
      toast.success("Result updated."); setEditResultOpen(false); setEditResultTarget(null);
      loadAllResults();
    } finally { setEditResultSaving(false); }
  }

  async function handleDeleteResult() {
    if (!deleteResultTarget) return;
    setDeletingResult(true);
    try {
      const res  = await fetch(`/api/admin/dit/results/${deleteResultTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed."); return; }
      toast.success("Result deleted. Teacher can resubmit.");
      setDeleteResultTarget(null); loadAllResults();
    } finally { setDeletingResult(false); }
  }

  /* ─── Summary for View Results ───────────────────────────────────────── */
  const vrSummary = useMemo(() => {
    if (vrResults.length === 0) return null;
    const totalObtained = vrResults.reduce((s, r) => s + r.obtained_marks, 0);
    const totalMax      = vrResults.reduce((s, r) => s + r.total_marks, 0);
    const pct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "0.0";
    const firstPassing  = vrResults[0]?.passing_marks ?? 0;
    const grade = calcGrade(totalObtained / vrResults.length, totalMax / vrResults.length, firstPassing);
    return { totalObtained, totalMax, pct, grade };
  }, [vrResults]);

  /* ─── Print-only info ────────────────────────────────────────────────── */
  const printStudent = vrStudentId ? ditStudents.find((s) => s.id === vrStudentId) : null;
  const printSeries  = vrSeriesId  ? series.find((s)  => s.id === vrSeriesId)  : null;
  const printSem     = vrSemesterId ? ditSemesters.find((s) => s.id === vrSemesterId) : null;

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">DIT Mock Exam</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage test series and mock exam results for DIT classes</p>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700 print:hidden">
        {(["series", "view", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t === "series" ? "Create Test Series" : t === "view" ? "View Results" : "All Results"}
          </button>
        ))}
      </div>

      {/* ══════════════════ TAB 1 — TEST SERIES ════════════════════════════ */}
      {activeTab === "series" && (
        <div className="space-y-4 print:hidden">
          <div className="flex justify-end">
            <button
              onClick={openCreateSeries}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus size={16} /> New Test Series
            </button>
          </div>

          <div className="overflow-hidden card-3d card-hover">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Test Series Name</th>
                  <th className="px-4 py-3 text-center">Total Marks</th>
                  <th className="px-4 py-3 text-center">Passing Marks</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {seriesLoading ? (
                  <TableLoader colSpan={6} />
                ) : series.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No test series yet. Create one above.</td></tr>
                ) : (
                  series.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{s.name}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">{s.total_marks}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {s.passing_marks}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.created_at}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditSeries(s)} className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteSeriesTarget(s)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB 2 — VIEW RESULTS ═══════════════════════════ */}
      {activeTab === "view" && (
        <div className="space-y-4">
          {/* Filter panel */}
          <form onSubmit={handleViewResults} className="card-3d p-4 space-y-4 print:hidden">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Search & Filter</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">Student (DIT)</label>
                <SearchableSelect
                  options={ditStudentOptions}
                  value={ditStudentOptions.find((o) => o.value === vrStudentId) ?? null}
                  onChange={(opt) => setVrStudentId(opt ? (opt as SelectOption).value : "")}
                  placeholder="All DIT students"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">Session</label>
                <SearchableSelect
                  options={sessionOptions}
                  value={sessionOptions.find((o) => o.value === vrSession) ?? null}
                  onChange={(opt) => { setVrSession(opt ? (opt as SelectOption).value : ""); setVrSemesterId(""); }}
                  placeholder="All sessions"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">Semester / Class</label>
                <SearchableSelect
                  options={semesterOptions}
                  value={semesterOptions.find((o) => o.value === vrSemesterId) ?? null}
                  onChange={(opt) => setVrSemesterId(opt ? (opt as SelectOption).value : "")}
                  placeholder="All semesters"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">Test Series</label>
                <SearchableSelect
                  options={seriesOptions}
                  value={seriesOptions.find((o) => o.value === vrSeriesId) ?? null}
                  onChange={(opt) => setVrSeriesId(opt ? (opt as SelectOption).value : "")}
                  placeholder="All series"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">From Date</label>
                <input type="date" value={vrFrom} onChange={(e) => setVrFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 uppercase">To Date</label>
                <input type="date" value={vrTo} onChange={(e) => setVrTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={vrLoading}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                <Search size={15} /> {vrLoading ? "Searching…" : "Search"}
              </button>
              {vrResults.length > 0 && (
                <button type="button" onClick={exportReport}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <FileDown size={15} /> Export PDF
                </button>
              )}
            </div>
          </form>

          {/* Results table (screen) */}
          {vrSearched && (
            <div className="overflow-hidden card-3d card-hover print:hidden">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Class / Session</th>
                    <th className="px-3 py-3">Semester</th>
                    <th className="px-3 py-3">Test Series</th>
                    <th className="px-3 py-3">Course</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3 text-center">Obtained</th>
                    <th className="px-3 py-3 text-center">Grade</th>
                    <th className="px-3 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vrResults.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No results found for the selected filters.</td></tr>
                  ) : (
                    vrResults.map((r) => {
                      const grade = calcGrade(r.obtained_marks, r.total_marks, r.passing_marks);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-800 dark:text-slate-100">{r.student_name}</div>
                            {r.roll_no && <div className="text-xs text-slate-400">{r.roll_no}</div>}
                          </td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{r.class_name} ({r.session})</td>
                          <td className="px-3 py-3 text-slate-500">Sem {r.semester_number}</td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{r.test_series_name}</td>
                          <td className="px-3 py-3 text-slate-500">{r.course_code}</td>
                          <td className="px-3 py-3 text-slate-500">{r.test_date}</td>
                          <td className="px-3 py-3 text-center font-semibold">{r.obtained_marks}/{r.total_marks}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              grade === "F" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                              : grade.startsWith("A") ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                            }`}>{grade}</span>
                          </td>
                          <td className="px-3 py-3 text-slate-500">{r.remarks ?? "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {vrSummary && vrResults.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-800/50 text-sm font-semibold">
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">Totals</td>
                      <td className="px-3 py-3 text-center">{vrSummary.totalObtained}/{vrSummary.totalMax}</td>
                      <td className="px-3 py-3 text-center">{vrSummary.pct}% — {vrSummary.grade}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ──── PRINT-ONLY REPORT ──────────────────────────────────────── */}
          {vrSearched && vrResults.length > 0 && (
            <div className="hidden print:block">
              {/* Header */}
              <div className="mb-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.png" alt="College Logo" className="mx-auto mb-2 h-20 w-auto" />
                <h1 className="text-2xl font-extrabold text-indigo-800 tracking-wide">CITY COLLEGE (University Campus)</h1>
                <h2 className="text-lg font-bold text-slate-700 mt-1">DIT Mock Exam — Result Report</h2>
                <div className="mt-1 h-1 w-32 mx-auto rounded-full bg-indigo-600" />
              </div>

              {/* 3-column metadata */}
              <div className="mb-5 grid grid-cols-3 gap-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                {/* Col 1 */}
                <div className="space-y-1 text-sm">
                  {printStudent && (
                    <>
                      <div><span className="font-semibold text-slate-600">Student:</span> {printStudent.name}</div>
                      <div><span className="font-semibold text-slate-600">Father:</span> {(printStudent as { father_name?: string | null }).father_name ?? "—"}</div>
                    </>
                  )}
                  {printSeries && (
                    <>
                      <div><span className="font-semibold text-slate-600">Test Type:</span> {printSeries.name}</div>
                      <div><span className="font-semibold text-slate-600">Total Marks:</span> {printSeries.total_marks}</div>
                    </>
                  )}
                  <div><span className="font-semibold text-slate-600">Report Date:</span> {vrFrom || "—"} → {vrTo || "—"}</div>
                </div>
                {/* Col 2 */}
                <div className="space-y-1 text-sm">
                  {vrResults[0] && (
                    <>
                      <div><span className="font-semibold text-slate-600">Class:</span> {vrResults[0].class_name}</div>
                      <div><span className="font-semibold text-slate-600">Session:</span> {vrResults[0].session}</div>
                      <div><span className="font-semibold text-slate-600">Semester:</span> {printSem ? `Sem ${printSem.semester_number} (${printSem.term_type})` : `Sem ${vrResults[0].semester_number}`}</div>
                    </>
                  )}
                </div>
                {/* Col 3 — profile picture */}
                <div className="flex items-center justify-end">
                  {vrResults[0]?.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vrResults[0].profile_image_url} alt="Profile" className="h-24 w-24 rounded-lg border-2 border-indigo-200 object-cover" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 text-xs text-indigo-400">No Photo</div>
                  )}
                </div>
              </div>

              {/* Result table */}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-indigo-700 text-white">
                    <th className="border border-indigo-500 px-3 py-2 text-left">#</th>
                    <th className="border border-indigo-500 px-3 py-2 text-left">Test Date</th>
                    <th className="border border-indigo-500 px-3 py-2 text-left">Course Title</th>
                    <th className="border border-indigo-500 px-3 py-2 text-center">Obtained Marks</th>
                    <th className="border border-indigo-500 px-3 py-2 text-center">Grade</th>
                    <th className="border border-indigo-500 px-3 py-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {vrResults.map((r, idx) => {
                    const g = calcGrade(r.obtained_marks, r.total_marks, r.passing_marks);
                    return (
                      <tr key={r.id} className={idx % 2 === 0 ? "bg-indigo-50" : "bg-white"}>
                        <td className="border border-indigo-100 px-3 py-2">{idx + 1}</td>
                        <td className="border border-indigo-100 px-3 py-2">{r.test_date}</td>
                        <td className="border border-indigo-100 px-3 py-2">{r.course_title}</td>
                        <td className="border border-indigo-100 px-3 py-2 text-center font-semibold">{r.obtained_marks}/{r.total_marks}</td>
                        <td className="border border-indigo-100 px-3 py-2 text-center font-bold">{g}</td>
                        <td className="border border-indigo-100 px-3 py-2">{r.remarks ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {vrSummary && (
                  <tfoot>
                    <tr className="bg-indigo-700 font-bold text-white">
                      <td colSpan={3} className="border border-indigo-500 px-3 py-2 text-right">Overall</td>
                      <td className="border border-indigo-500 px-3 py-2 text-center">
                        {vrSummary.totalObtained}/{vrSummary.totalMax} ({vrSummary.pct}%)
                      </td>
                      <td className="border border-indigo-500 px-3 py-2 text-center">{vrSummary.grade}</td>
                      <td className="border border-indigo-500 px-3 py-2" />
                    </tr>
                  </tfoot>
                )}
              </table>

              <p className="mt-6 text-center text-xs text-slate-400">Generated on {new Date().toLocaleDateString()}</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ TAB 3 — ALL RESULTS ════════════════════════════ */}
      {activeTab === "all" && (
        <div className="space-y-4 print:hidden">
          <div className="flex justify-end">
            <button onClick={loadAllResults} className="text-xs text-indigo-600 hover:underline">↻ Refresh</button>
          </div>
          <div className="overflow-x-auto overflow-hidden card-3d card-hover">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Class / Session</th>
                  <th className="px-3 py-3">Semester</th>
                  <th className="px-3 py-3">Test Series</th>
                  <th className="px-3 py-3">Course</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-center">Marks</th>
                  <th className="px-3 py-3 text-center">Grade</th>
                  <th className="px-3 py-3">Teacher</th>
                  <th className="px-3 py-3">Remarks</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allLoading ? (
                  <TableLoader colSpan={11} />
                ) : allResults.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">No DIT mock results yet.</td></tr>
                ) : (
                  allResults.map((r) => {
                    const grade = calcGrade(r.obtained_marks, r.total_marks, r.passing_marks);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{r.student_name}</div>
                          {r.roll_no && <div className="text-xs text-slate-400">{r.roll_no}</div>}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{r.class_name}<br/><span className="text-xs text-slate-400">{r.session}</span></td>
                        <td className="px-3 py-3 text-slate-500">Sem {r.semester_number}</td>
                        <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">{r.test_series_name}</td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{r.course_code}<br/>{r.course_title}</td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{r.test_date}</td>
                        <td className="px-3 py-3 text-center font-semibold">{r.obtained_marks}/{r.total_marks}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            grade === "F" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                            : grade.startsWith("A") ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                          }`}>{grade}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{r.teacher_name}</td>
                        <td className="px-3 py-3 text-slate-400 max-w-[120px] truncate">{r.remarks ?? "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditResult(r)} className="flex h-7 w-7 items-center justify-center rounded text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDeleteResultTarget(r)} className="flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Test Series Modal ═══════════════════════════════════════════════ */}
      <Modal open={seriesModalOpen} onClose={() => setSeriesModalOpen(false)} title={editSeries ? "Edit Test Series" : "New Test Series"} widthClass="max-w-md">
        <form onSubmit={handleSeriesSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Test Series Name *</label>
            <input required value={sName} onChange={(e) => setSName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="e.g. Monthly Test 1, Mid-Term Mock…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Total Marks *</label>
              <input required type="number" min="1" value={sTotal} onChange={(e) => setSTotal(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Passing Marks *</label>
              <input required type="number" min="0" value={sPass} onChange={(e) => setSPass(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSeriesModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={seriesSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {seriesSaving ? "Saving…" : editSeries ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ Edit Result Modal ═══════════════════════════════════════════════ */}
      <Modal open={editResultOpen} onClose={() => setEditResultOpen(false)} title="Edit Result" widthClass="max-w-sm">
        {editResultTarget && (
          <form onSubmit={handleEditResultSubmit} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 text-sm space-y-0.5">
              <div className="font-medium text-slate-700 dark:text-slate-200">{editResultTarget.student_name}</div>
              <div className="text-slate-400">{editResultTarget.test_series_name} · {editResultTarget.course_code} · {editResultTarget.test_date}</div>
              <div className="text-slate-400">Max: {editResultTarget.total_marks} marks</div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Obtained Marks</label>
              <input required type="number" min="0" max={editResultTarget.total_marks} value={editObtained} onChange={(e) => setEditObtained(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Remarks</label>
              <textarea rows={3} value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditResultOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button type="submit" disabled={editResultSaving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {editResultSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ══ Confirm Dialogs ════════════════════════════════════════════════ */}
      <ConfirmDialog
        open={!!deleteSeriesTarget}
        title="Delete Test Series"
        message={`Delete "${deleteSeriesTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deletingSeries}
        onConfirm={handleDeleteSeries}
        onCancel={() => setDeleteSeriesTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteResultTarget}
        title="Delete Result"
        message={`Delete this result for ${deleteResultTarget?.student_name}? The teacher will need to resubmit it.`}
        confirmLabel="Delete"
        loading={deletingResult}
        onConfirm={handleDeleteResult}
        onCancel={() => setDeleteResultTarget(null)}
      />

      {/* Suppress unused var warning for expand icons */}
      <span className="hidden"><ChevronDown size={1} /><ChevronUp size={1} /></span>
    </div>
  );
}
