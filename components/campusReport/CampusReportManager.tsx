"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2, UserX, Clock, RefreshCw, CalendarDays, Users, TrendingUp, Download,
} from "lucide-react";
import { DataFetchLoader } from "@/components/ui/Loaders";

/* ── types ─────────────────────────────────────────────────────────────────── */
interface DeptRow {
  department_id:   string;
  department_name: string;
  total_students:  number;
  presents:        number;
  absents:         number;
  percentage:      number | null;
}

interface AbsentTeacher {
  teacher_name:    string;
  course_code:     string;
  course_title:    string;
  department_name: string;
  teacher_type:    "permanent" | "visiting";
  remarks:         string | null;
}

interface LateTeacher {
  teacher_name:    string;
  course_code:     string;
  course_title:    string;
  department_name: string;
  teacher_type:    "permanent" | "visiting";
  late_minutes:    number;
}

/* ── helpers ────────────────────────────────────────────────────────────────── */
function pctBadge(pct: number | null) {
  if (pct === null) return <span className="text-slate-400 dark:text-slate-500">—</span>;
  const cls =
    pct >= 75 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
    : pct >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${cls}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cls =
    type === "permanent"
      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
      : "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {type}
    </span>
  );
}

function SectionCard({
  icon: Icon, title, count, countLabel, color, children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  countLabel: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className={`flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 ${color}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20">
          <Icon size={17} />
        </span>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-0.5 text-xs font-bold text-slate-700 dark:bg-black/25 dark:text-slate-200">
          {count} {countLabel}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── main component ─────────────────────────────────────────────────────────── */
export default function CampusReportManager() {
  const [date,           setDate]           = useState("");
  const [deptRows,       setDeptRows]       = useState<DeptRow[]>([]);
  const [absentTeachers, setAbsentTeachers] = useState<AbsentTeacher[]>([]);
  const [lateTeachers,   setLateTeachers]   = useState<LateTeacher[]>([]);
  const [loading,        setLoading]        = useState(false);

  /* set today's date client-side (avoids SSR hydration mismatch) */
  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
  }, []);

  const load = useCallback(async (d: string) => {
    if (!d) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/campus-report?date=${d}`);
      const data = await res.json();
      if (res.ok) {
        setDeptRows(data.departments       ?? []);
        setAbsentTeachers(data.absentTeachers ?? []);
        setLateTeachers(data.lateTeachers   ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (date) load(date); }, [date, load]);

  /* totals row */
  const totalStudents = deptRows.reduce((s, r) => s + r.total_students, 0);
  const totalPresents = deptRows.reduce((s, r) => s + r.presents,       0);
  const totalAbsents  = deptRows.reduce((s, r) => s + r.absents,        0);
  const totalPct      = totalStudents > 0
    ? parseFloat(((totalPresents / totalStudents) * 100).toFixed(1))
    : null;

  /* friendly date label */
  const displayDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-PK", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : "";

  return (
    <>
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">Campus Report</h1>
          {displayDate && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{displayDate}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <CalendarDays size={15} className="text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
            />
          </div>
          <button
            onClick={() => load(date)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading || deptRows.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download size={13} />
            Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <DataFetchLoader label="Generating campus report…" />
      ) : (
        <>
          {/* ── 1. Department-wise Student Attendance ─────────────────────── */}
          <SectionCard
            icon={Building2}
            title="Department-wise Attendance"
            count={deptRows.length}
            countLabel="departments"
            color="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20"
          >
            {deptRows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No coordinator-marked attendance found for this date.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">#</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3 text-center">Total Students</th>
                      <th className="px-5 py-3 text-center">Present</th>
                      <th className="px-5 py-3 text-center">Absent</th>
                      <th className="px-5 py-3 text-center">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {deptRows.map((r, i) => (
                      <tr key={r.department_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                          {r.department_name}
                        </td>
                        <td className="px-5 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {r.total_students}
                        </td>
                        <td className="px-5 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                          {r.presents}
                        </td>
                        <td className="px-5 py-3 text-center font-semibold text-red-500 dark:text-red-400">
                          {r.absents}
                        </td>
                        <td className="px-5 py-3 text-center">{pctBadge(r.percentage)}</td>
                      </tr>
                    ))}

                    {/* ── Totals row (highlighted) ─────────────────────────── */}
                    <tr className="border-t-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 dark:border-indigo-700 dark:from-indigo-900/30 dark:to-blue-900/30">
                      <td className="px-5 py-3" />
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-indigo-500" />
                          <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                            OVERALL TOTAL
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center text-base font-extrabold text-slate-800 dark:text-slate-100">
                        {totalStudents}
                      </td>
                      <td className="px-5 py-3 text-center text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                        {totalPresents}
                      </td>
                      <td className="px-5 py-3 text-center text-base font-extrabold text-red-600 dark:text-red-400">
                        {totalAbsents}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${
                          totalPct === null ? "text-slate-400"
                          : totalPct >= 75 ? "bg-emerald-600 text-white"
                          : totalPct >= 60 ? "bg-amber-500 text-white"
                          : "bg-red-600 text-white"
                        }`}>
                          {totalPct !== null ? `${totalPct.toFixed(1)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ── 2. Absent Teachers ─────────────────────────────────────────── */}
          <SectionCard
            icon={UserX}
            title="Absent Teachers"
            count={absentTeachers.length}
            countLabel={absentTeachers.length === 1 ? "teacher" : "teachers"}
            color="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20"
          >
            {absentTeachers.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No absent teachers recorded for this date.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">#</th>
                      <th className="px-5 py-3">Teacher Name</th>
                      <th className="px-5 py-3">Subject / Course</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {absentTeachers.map((t, i) => (
                      <tr key={i} className="hover:bg-red-50/30 dark:hover:bg-red-900/10">
                        <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-5 py-3">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{t.teacher_name}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-300">{t.course_code}</span>
                          {" — "}
                          {t.course_title}
                        </td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{t.department_name}</td>
                        <td className="px-5 py-3 text-center">
                          <TypeBadge type={t.teacher_type} />
                        </td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                          {t.remarks || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ── 3. Late Teachers ───────────────────────────────────────────── */}
          <SectionCard
            icon={Clock}
            title="Late Teachers"
            count={lateTeachers.length}
            countLabel={lateTeachers.length === 1 ? "teacher" : "teachers"}
            color="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20"
          >
            {lateTeachers.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No late teachers recorded for this date.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3">#</th>
                      <th className="px-5 py-3">Teacher Name</th>
                      <th className="px-5 py-3">Subject / Course</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-center">Minutes Late</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lateTeachers.map((t, i) => (
                      <tr key={i} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10">
                        <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-5 py-3">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{t.teacher_name}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-300">{t.course_code}</span>
                          {" — "}
                          {t.course_title}
                        </td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{t.department_name}</td>
                        <td className="px-5 py-3 text-center">
                          <TypeBadge type={t.teacher_type} />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                            t.late_minutes >= 15
                              ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                          }`}>
                            <Clock size={10} />
                            {t.late_minutes} min
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Quick summary strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Departments Reported", value: deptRows.length,        color: "text-indigo-600 dark:text-indigo-400" },
              { label: "Overall Attendance",   value: totalPct !== null ? `${totalPct.toFixed(1)}%` : "—", color: totalPct !== null && totalPct >= 75 ? "text-emerald-600" : "text-red-600" },
              { label: "Absent Teachers",      value: absentTeachers.length,  color: "text-red-600 dark:text-red-400" },
              { label: "Late Teachers",        value: lateTeachers.length,    color: "text-amber-600 dark:text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className={`mt-1 text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>

    {/* ── Print-only area (hidden on screen, visible on print via globals.css) ── */}
    <div id="campus-report-print-area" style={{ display: "none", fontFamily: "Arial, sans-serif", color: "#111", padding: "0 8px" }}>

      {/* Logo + title */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="City College — University Campus" style={{ height: 64, width: "auto", objectFit: "contain" }} />
      </div>
      <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: "bold", margin: "0 0 4px" }}>
        Campus Report
      </h1>
      <p style={{ textAlign: "center", fontSize: 13, color: "#555", margin: "0 0 24px" }}>
        {date
          ? new Date(date + "T00:00:00").toLocaleDateString("en-PK", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })
          : ""}
      </p>
      <hr style={{ border: "none", borderTop: "2px solid #3730a3", marginBottom: 20 }} />

      {/* ── Section 1: Department-wise Attendance ── */}
      <h2 style={{ fontSize: 14, fontWeight: "bold", marginBottom: 8, color: "#3730a3" }}>
        1. Department-wise Student Attendance
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#e0e7ff" }}>
            {["#", "Department", "Total Students", "Present", "Absent", "Attendance %"].map((h) => (
              <th key={h} style={{ border: "1px solid #c7d2fe", padding: "6px 10px", textAlign: h === "Department" || h === "#" ? "left" : "center", fontWeight: "bold" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deptRows.map((r, i) => (
            <tr key={r.department_id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f8ff" }}>
              <td style={{ border: "1px solid #e0e7ff", padding: "5px 10px", color: "#888" }}>{i + 1}</td>
              <td style={{ border: "1px solid #e0e7ff", padding: "5px 10px", fontWeight: 500 }}>{r.department_name}</td>
              <td style={{ border: "1px solid #e0e7ff", padding: "5px 10px", textAlign: "center", fontWeight: "bold" }}>{r.total_students}</td>
              <td style={{ border: "1px solid #e0e7ff", padding: "5px 10px", textAlign: "center", color: "#059669", fontWeight: "bold" }}>{r.presents}</td>
              <td style={{ border: "1px solid #e0e7ff", padding: "5px 10px", textAlign: "center", color: "#dc2626", fontWeight: "bold" }}>{r.absents}</td>
              <td style={{ border: "1px solid #e0e7ff", padding: "5px 10px", textAlign: "center", fontWeight: "bold",
                color: r.percentage === null ? "#aaa" : r.percentage >= 75 ? "#059669" : r.percentage >= 60 ? "#d97706" : "#dc2626" }}>
                {r.percentage !== null ? `${r.percentage.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr style={{ background: "#e0e7ff", fontWeight: "bold" }}>
            <td style={{ border: "1px solid #c7d2fe", padding: "6px 10px" }} />
            <td style={{ border: "1px solid #c7d2fe", padding: "6px 10px", color: "#3730a3" }}>OVERALL TOTAL</td>
            <td style={{ border: "1px solid #c7d2fe", padding: "6px 10px", textAlign: "center" }}>{totalStudents}</td>
            <td style={{ border: "1px solid #c7d2fe", padding: "6px 10px", textAlign: "center", color: "#059669" }}>{totalPresents}</td>
            <td style={{ border: "1px solid #c7d2fe", padding: "6px 10px", textAlign: "center", color: "#dc2626" }}>{totalAbsents}</td>
            <td style={{ border: "1px solid #c7d2fe", padding: "6px 10px", textAlign: "center",
              color: totalPct === null ? "#aaa" : totalPct >= 75 ? "#059669" : totalPct >= 60 ? "#d97706" : "#dc2626" }}>
              {totalPct !== null ? `${totalPct.toFixed(1)}%` : "—"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Section 2: Absent Teachers ── */}
      <h2 style={{ fontSize: 14, fontWeight: "bold", marginBottom: 8, color: "#991b1b" }}>
        2. Absent Teachers ({absentTeachers.length})
      </h2>
      {absentTeachers.length === 0 ? (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>No absent teachers recorded for this date.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#fee2e2" }}>
              {["#", "Teacher Name", "Course", "Department", "Type", "Remarks"].map((h) => (
                <th key={h} style={{ border: "1px solid #fecaca", padding: "6px 10px", textAlign: "left", fontWeight: "bold" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {absentTeachers.map((t, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fff5f5" }}>
                <td style={{ border: "1px solid #fecaca", padding: "5px 10px", color: "#888" }}>{i + 1}</td>
                <td style={{ border: "1px solid #fecaca", padding: "5px 10px", fontWeight: 500 }}>{t.teacher_name}</td>
                <td style={{ border: "1px solid #fecaca", padding: "5px 10px" }}>
                  <span style={{ fontWeight: "bold", color: "#3730a3" }}>{t.course_code}</span> — {t.course_title}
                </td>
                <td style={{ border: "1px solid #fecaca", padding: "5px 10px" }}>{t.department_name}</td>
                <td style={{ border: "1px solid #fecaca", padding: "5px 10px", textTransform: "capitalize" }}>{t.teacher_type}</td>
                <td style={{ border: "1px solid #fecaca", padding: "5px 10px", color: "#555" }}>{t.remarks ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Section 3: Late Teachers ── */}
      <h2 style={{ fontSize: 14, fontWeight: "bold", marginBottom: 8, color: "#92400e" }}>
        3. Late Teachers ({lateTeachers.length})
      </h2>
      {lateTeachers.length === 0 ? (
        <p style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>No late teachers recorded for this date.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#fef3c7" }}>
              {["#", "Teacher Name", "Course", "Department", "Type", "Minutes Late"].map((h) => (
                <th key={h} style={{ border: "1px solid #fde68a", padding: "6px 10px", textAlign: h === "Minutes Late" ? "center" : "left", fontWeight: "bold" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lateTeachers.map((t, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fffbeb" }}>
                <td style={{ border: "1px solid #fde68a", padding: "5px 10px", color: "#888" }}>{i + 1}</td>
                <td style={{ border: "1px solid #fde68a", padding: "5px 10px", fontWeight: 500 }}>{t.teacher_name}</td>
                <td style={{ border: "1px solid #fde68a", padding: "5px 10px" }}>
                  <span style={{ fontWeight: "bold", color: "#3730a3" }}>{t.course_code}</span> — {t.course_title}
                </td>
                <td style={{ border: "1px solid #fde68a", padding: "5px 10px" }}>{t.department_name}</td>
                <td style={{ border: "1px solid #fde68a", padding: "5px 10px", textTransform: "capitalize" }}>{t.teacher_type}</td>
                <td style={{ border: "1px solid #fde68a", padding: "5px 10px", textAlign: "center",
                  fontWeight: "bold", color: t.late_minutes >= 15 ? "#dc2626" : "#d97706" }}>
                  {t.late_minutes} min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Footer */}
      <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0 6px" }} />
      <p style={{ textAlign: "center", fontSize: 10, color: "#aaa" }}>
        Generated on {typeof window !== "undefined" ? new Date().toLocaleString("en-PK") : ""} — City College University Campus
      </p>
    </div>
    </>
  );
}
