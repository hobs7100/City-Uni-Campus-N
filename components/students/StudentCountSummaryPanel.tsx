"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, GraduationCap, RefreshCw, Users } from "lucide-react";
import type { StudentCountSummary } from "@/lib/student-count-summary";

function SummarySkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading student count summary">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="card-3d h-24 animate-pulse bg-slate-100/80 dark:bg-slate-800/70" />
        ))}
      </div>
      <div className="card-3d overflow-hidden p-5">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-10 animate-pulse rounded bg-slate-50 dark:bg-slate-800/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StudentCountSummaryPanel() {
  const [summary, setSummary] = useState<StudentCountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/students/count-summary", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "The student count summary could not be loaded.");
      }
      if (!payload || !Array.isArray(payload.departments)) {
        throw new Error("The server returned an invalid student count summary.");
      }
      setSummary(payload as StudentCountSummary);
    } catch (loadError) {
      setSummary(null);
      setError(loadError instanceof Error ? loadError.message : "The student count summary could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function exportPdf() {
    if (!summary || exporting) return;
    setExporting(true);
    setError("");
    try {
      const { createStudentCountSummaryPdf } = await import("@/lib/student-count-summary-pdf");
      const doc = await createStudentCountSummaryPdf(summary);
      doc.save("student-count-summary.pdf");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "The PDF could not be created. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <SummarySkeleton />;

  if (error && !summary) {
    return (
      <section className="card-3d flex flex-col items-center px-5 py-12 text-center" role="alert">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle size={21} />
        </div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Summary unavailable</h2>
        <p className="mt-1 max-w-lg text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button
          type="button"
          onClick={() => void loadSummary()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw size={15} /> Retry
        </button>
      </section>
    );
  }

  if (!summary) return null;

  const stats = [
    {
      label: "Sessions",
      value: summary.total_sessions.toLocaleString(),
      detail: summary.sessions.length ? summary.sessions.join(" · ") : "No session names",
      icon: RefreshCw,
      tone: "indigo",
    },
    {
      label: "Active classes",
      value: summary.total_classes.toLocaleString(),
      detail: "Active classes only",
      icon: GraduationCap,
      tone: "teal",
    },
    {
      label: "Total students",
      value: summary.total_students.toLocaleString(),
      detail: "Active and struck-off students",
      icon: Users,
      tone: "amber",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, detail, icon: Icon, tone }) => (
          <div key={label} className="card-3d flex min-w-0 items-start gap-3 p-4 sm:p-5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              tone === "indigo"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : tone === "teal"
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            }`}>
              <Icon size={19} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</p>
              <p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card-3d overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Student Count Summary</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Counts include active and struck-off students in active classes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exporting}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? "Preparing PDF…" : "Export PDF"}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 p-3 sm:p-5">
          {summary.total_classes === 0 && (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No active classes to summarize. The PDF will show the current zero totals.
            </div>
          )}
          {summary.departments.map((department) => (
            <section key={department.department_id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{department.department_name}</h3>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
                  {department.total_students.toLocaleString()} students
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-white text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Class Name</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Session</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Current Active Semester</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Total Students</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {department.classes.map((row) => (
                      <tr key={row.class_id} className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.class_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{row.session}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.active_semester_number == null ? "No active semester" : `Semester ${row.active_semester_number}`}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{row.total_students.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                      <td colSpan={3} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Department total</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{department.total_students.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
