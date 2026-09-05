"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FileCheck2, Search, Eye, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, User, ShieldCheck, Trash2, X, FileDown,
} from "lucide-react";
import { ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";

/* ── types ─────────────────────────────────────────────────────────────── */
interface Override {
  id: string;
  allowed_at: string;
  notes: string | null;
  allowed_by: string | null;
  allowed_by_id: string | null;
}

interface StudentRow {
  student_id: string;
  name: string;
  father_name: string | null;
  roll_no: string | null;
  class_name: string;
  session: string;
  department_name: string;
  semester_number: number;
  presents: number;
  absents: number;
  att_percentage: number;
  leave_type: "partial" | null;
  policy_threshold: number;
  override: Override | null;
}

interface CourseHistory {
  course_id: string;
  course_code: string;
  course_title: string;
  teacher_name: string;
  presents: number;
  absents: number;
  att_pct: number | null;
}

interface SemesterHistory {
  semester_id: string;
  semester_number: number;
  term_type: string;
  presents: number;
  absents: number;
  leaves: number;
  overall_pct: number | null;
  courses: CourseHistory[];
}

interface StudentHistory {
  student: {
    id: string; name: string; father_name: string | null;
    roll_no: string | null; class_name: string; session: string;
    department_name: string;
  };
  semesters: SemesterHistory[];
}

interface AdminSlipData {
  student: {
    name: string;
    father_name: string | null;
    roll_no: string | null;
    class_name: string;
    session: string;
    department: string;
  };
  semester: { semester_number: number; term_type: string };
  overall_attendance: number;
  rows: Array<{
    course_id: string;
    course_code: string;
    course_title: string;
    paper_date: string | null;
    att_percentage: number;
  }>;
}

/* ── helpers ────────────────────────────────────────────────────────────── */
function AttBadge({ pct, threshold = 75 }: { pct: number | null; threshold?: number }) {
  if (pct === null) return <span className="text-slate-400 text-xs">No data</span>;
  const color =
    pct >= threshold ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
    : pct >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
    :              "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

/* ── History Modal ──────────────────────────────────────────────────────── */
function HistoryModal({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const [data,    setData]    = useState<StudentHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSem, setOpenSem] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/rollno-slips/history/${studentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.student) {
          setData(d);
          // auto-open first semester
          if (d.semesters?.length) setOpenSem(d.semesters[0].semester_id);
        }
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/10">
              <Eye size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Attendance History
              </h2>
              {data && (
                <p className="text-xs text-slate-500">
                  {data.student.name}
                  {data.student.father_name && ` S/O ${data.student.father_name}`}
                  {" · "}{data.student.class_name} ({data.student.session})
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center py-12">
              <DataFetchLoader />
            </div>
          )}

          {!loading && data && data.semesters.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">No attendance records found.</p>
          )}

          {!loading && data && data.semesters.map((sem) => (
            <div key={sem.semester_id} className="mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              {/* Semester header — clickable accordion */}
              <button
                className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                onClick={() => setOpenSem(openSem === sem.semester_id ? null : sem.semester_id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Semester {sem.semester_number}
                    <span className="ml-2 text-xs font-normal capitalize text-slate-400">
                      ({sem.term_type})
                    </span>
                  </span>
                  {/* Overall badge */}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Overall (Coord/Admin):
                  </span>
                  <AttBadge pct={sem.overall_pct} />
                  <span className="text-xs text-slate-400">
                    {sem.presents}P / {sem.absents}A / {sem.leaves}L
                  </span>
                </div>
                {openSem === sem.semester_id
                  ? <ChevronUp size={16} className="text-slate-400" />
                  : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {/* Course-wise breakdown */}
              {openSem === sem.semester_id && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sem.courses.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-400">No teacher-marked course data for this semester.</p>
                  ) : (
                    sem.courses.map((cr) => (
                      <div key={cr.course_id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            <span className="mr-2 text-xs font-bold text-indigo-500">{cr.course_code}</span>
                            {cr.course_title}
                          </p>
                          <p className="text-xs text-slate-400">
                            Teacher: {cr.teacher_name} · {cr.presents}P / {cr.absents}A
                          </p>
                        </div>
                        <AttBadge pct={cr.att_pct} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Allow / Revoke modal ───────────────────────────────────────────────── */
function AllowModal({
  student,
  onClose,
  onSaved,
}: {
  student: StudentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes,   setNotes]   = useState(student.override?.notes ?? "");
  const [saving,  setSaving]  = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleAllow = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/rollno-slips/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.student_id, notes: notes || null }),
      });
      if (res.ok) {
        toast.success("Override granted — student can now print their slip.");
        onSaved();
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to grant override.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch("/api/admin/rollno-slips/override", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.student_id }),
      });
      if (res.ok) {
        toast.success("Override revoked.");
        onSaved();
      } else {
        toast.error("Failed to revoke override.");
      }
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {student.override ? "Update Override" : "Allow Print Override"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Student info */}
          <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{student.name}</p>
            {student.father_name && (
              <p className="text-xs text-slate-500">S/O {student.father_name}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {student.class_name} · {student.session} · Sem {student.semester_number}
            </p>
            <p className="mt-1 text-xs font-semibold text-red-500">
              Attendance: {student.att_percentage.toFixed(1)}%
              ({student.presents}P / {student.absents}A)
            </p>
          </div>

          {/* Current override info */}
          {student.override && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Override active
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                Allowed by: {student.override.allowed_by ?? "—"} on{" "}
                {student.override.allowed_at
                  ? new Date(student.override.allowed_at).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes / Reason (optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Medical certificate submitted, HoD approval granted…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleAllow}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? <ButtonLoader /> : <ShieldCheck size={15} />}
              {student.override ? "Update Override" : "Allow Print"}
            </button>

            {student.override && (
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
              >
                {revoking ? <ButtonLoader /> : <Trash2 size={14} />}
                Revoke
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function RollnoSlipsPage() {
  const [students,  setStudents]  = useState<StudentRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [allowFor,  setAllowFor]  = useState<StudentRow | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/rollno-slips");
      const data = await res.json();
      if (res.ok) setStudents(data.students ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const printSlip = async (student: StudentRow) => {
    setPrintingId(student.student_id);
    try {
      const response = await fetch(`/api/admin/rollno-slips/${student.student_id}`);
      const data = (await response.json()) as AdminSlipData & { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Unable to prepare the Roll Number Slip.");
        return;
      }
      const formatDate = (value: string | null) =>
        value
          ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PK", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—";
      const rows = data.rows
        .map(
          (row) => `<tr>
            <td>${escapePrintHtml(row.course_code)}</td>
            <td>${escapePrintHtml(row.course_title)}</td>
            <td class="center">${escapePrintHtml(row.att_percentage.toFixed(1))}%</td>
            <td class="center">${escapePrintHtml(formatDate(row.paper_date))}</td>
          </tr>`,
        )
        .join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"/>
        <title>Roll Number Slip</title>
        <style>
          @page{size:A4 portrait;margin:14mm}
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          body{font-family:Arial,sans-serif;color:#1e293b;margin:0}
          .slip{border:2px solid #3730a3;border-radius:8px;overflow:hidden}
          header{text-align:center;border-bottom:2px solid #3730a3;padding:16px}
          header img{height:58px;max-width:100%;object-fit:contain}
          h1{font-size:20px;color:#3730a3;margin:8px 0 2px;text-transform:uppercase}
          .meta{padding:14px 20px;background:#f8fafc;display:grid;grid-template-columns:1fr 1fr;gap:7px 24px;font-size:12px}
          .meta strong{color:#475569}
          main{padding:18px 20px}
          table{width:100%;border-collapse:collapse;font-size:11px}
          th{background:#3730a3;color:#fff;text-align:left}
          th,td{border:1px solid #cbd5e1;padding:7px 9px}
          .center{text-align:center}
          footer{background:#3730a3;color:#c7d2fe;padding:9px 20px;font-size:9px;text-align:center}
        </style></head><body><section class="slip">
          <header><img src="${window.location.origin}/images/logo.png" alt="City College"/>
            <h1>Roll Number Slip</h1>
            <div>Mid Term Examination — ${escapePrintHtml(data.semester.term_type)} ${escapePrintHtml(data.student.session)}</div>
          </header>
          <div class="meta">
            <div><strong>Student:</strong> ${escapePrintHtml(data.student.name)}</div>
            <div><strong>Father:</strong> ${escapePrintHtml(data.student.father_name || "—")}</div>
            <div><strong>Roll No:</strong> ${escapePrintHtml(data.student.roll_no || "—")}</div>
            <div><strong>Class:</strong> ${escapePrintHtml(data.student.class_name)}</div>
            <div><strong>Department:</strong> ${escapePrintHtml(data.student.department)}</div>
            <div><strong>Semester:</strong> ${escapePrintHtml(data.semester.semester_number)}</div>
            <div><strong>Attendance:</strong> ${escapePrintHtml(data.overall_attendance.toFixed(1))}%</div>
            <div><strong>Issue Date:</strong> ${escapePrintHtml(new Date().toLocaleDateString("en-PK"))}</div>
          </div>
          <main><table><thead><tr><th>Course Code</th><th>Course Title</th><th class="center">Attendance</th><th class="center">Paper Date</th></tr></thead>
            <tbody>${rows}</tbody></table></main>
          <footer>This is a computer-generated slip and does not require a signature.</footer>
        </section></body></html>`;
      await printHtmlDocument(html, `Roll Number Slip — ${student.name}`);
    } catch {
      toast.error("Unable to open the print dialog. Please try again.");
    } finally {
      setPrintingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.father_name ?? "").toLowerCase().includes(q) ||
        (s.roll_no ?? "").toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q) ||
        s.session.toLowerCase().includes(q) ||
        s.department_name.toLowerCase().includes(q),
    );
  }, [students, search]);

  const overrideCount = students.filter((s) => s.override).length;
  const pendingCount  = students.filter((s) => !s.override).length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/10">
            <FileCheck2 size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Roll No. Slips</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Students blocked below their policy threshold (Regular 75% · Partial Leave 40%) — grant or revoke print overrides
            </p>
          </div>
        </div>
      </div>

      {/* Summary pills */}
      {!loading && (
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <User size={14} className="text-indigo-500" />
            {students.length} blocked student{students.length !== 1 ? "s" : ""}
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle size={14} />
              {pendingCount} pending override
            </div>
          )}
          {overrideCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <ShieldCheck size={14} />
              {overrideCount} override{overrideCount !== 1 ? "s" : ""} granted
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, father name, roll no, class or department…"
          className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <DataFetchLoader />
        </div>
      )}

      {/* Empty */}
      {!loading && students.length === 0 && (
        <div className="card-3d flex flex-col items-center gap-3 rounded-2xl py-20 text-center">
          <CheckCircle2 size={48} className="text-emerald-400" />
          <p className="font-semibold text-slate-600 dark:text-slate-300">All students meet the attendance requirement</p>
          <p className="text-sm text-slate-400">No students are currently blocked from printing their roll number slips.</p>
        </div>
      )}

      {/* No search match */}
      {!loading && students.length > 0 && filtered.length === 0 && (
        <div className="card-3d flex flex-col items-center gap-3 rounded-2xl py-12 text-center">
          <Search size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500">No students match &ldquo;{search}&rdquo;.</p>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="card-3d overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Class / Session</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-center">Sem</th>
                  <th className="px-4 py-3 text-center">Attendance</th>
                  <th className="px-4 py-3 text-left">Override</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((s, idx) => (
                  <tr key={s.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-400">{idx + 1}</td>

                    {/* Student name + father name + roll no */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{s.name}</p>
                      {s.father_name && (
                        <p className="text-xs text-slate-400">S/O {s.father_name}</p>
                      )}
                      {s.roll_no && (
                        <p className="text-xs font-mono text-indigo-500">{s.roll_no}</p>
                      )}
                    </td>

                    {/* Class / session */}
                    <td className="px-4 py-3">
                      <p className="text-slate-700 dark:text-slate-200">{s.class_name}</p>
                      <p className="text-xs text-slate-400">{s.session}</p>
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.department_name}</td>

                    {/* Semester */}
                    <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                      {s.semester_number}
                    </td>

                    {/* Attendance % */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <AttBadge pct={s.att_percentage} threshold={s.policy_threshold} />
                        <span className="text-[10px] text-slate-400">{s.presents}P / {s.absents}A</span>
                      </div>
                    </td>

                    {/* Override status */}
                    <td className="px-4 py-3">
                      {s.override ? (
                        <div>
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={13} />
                            <span className="text-xs font-semibold">Allowed</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            by {s.override.allowed_by ?? "—"}{" "}
                            {s.override.allowed_at &&
                              new Date(s.override.allowed_at).toLocaleDateString("en-GB", {
                                day: "2-digit", month: "short", year: "2-digit",
                              })}
                          </p>
                          {s.override.notes && (
                            <p className="mt-0.5 max-w-[160px] truncate text-[10px] text-slate-400 italic" title={s.override.notes}>
                              {s.override.notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-500">
                          <XCircle size={13} />
                          <span className="text-xs font-medium">Blocked</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setHistoryId(s.student_id)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <Eye size={12} />
                          History
                        </button>
                        <button
                          onClick={() => printSlip(s)}
                          disabled={printingId === s.student_id}
                          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                        >
                          {printingId === s.student_id ? <ButtonLoader /> : <FileDown size={12} />}
                          PDF
                        </button>
                        <button
                          onClick={() => setAllowFor(s)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            s.override
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-indigo-600 text-white hover:bg-indigo-700"
                          }`}
                        >
                          <ShieldCheck size={12} />
                          {s.override ? "Manage" : "Allow Print"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyId && (
        <HistoryModal
          studentId={historyId}
          onClose={() => setHistoryId(null)}
        />
      )}

      {/* Allow / Revoke modal */}
      {allowFor && (
        <AllowModal
          student={allowFor}
          onClose={() => setAllowFor(null)}
          onSaved={() => {
            setAllowFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
