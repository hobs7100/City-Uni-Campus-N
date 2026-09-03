"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, School } from "lucide-react";
import { DataFetchLoader } from "@/components/ui/Loaders";
import { formatDateOnly } from "@/lib/format";

interface SummaryRow {
  university_name: string;
  class_id: string;
  session: string;
  class_name: string;
  semester_number: number;
  start_date: string;
  mid_term_status: "conducted" | "pending";
  mid_term_date: string | null;
}

export default function OverallClassesSummaryManager() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overall-classes-summary", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to load the classes summary.");
        return;
      }
      setRows(data.rows ?? []);
    } catch {
      setError("Unable to load the classes summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, SummaryRow[]>();
    for (const row of rows) {
      const group = groups.get(row.university_name) ?? [];
      group.push(row);
      groups.set(row.university_name, group);
    }
    return Array.from(groups.entries());
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-tile grad-primary h-11 w-11">
            <School size={20} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">
              Overall Classes Summary
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Active semesters grouped by university affiliation
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading ? (
        <DataFetchLoader label="Loading classes summary…" />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : groupedRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No classes with an active semester were found.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/70 px-5 py-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <p className="text-sm text-indigo-900 dark:text-indigo-200">
              Showing classes with an active semester only.
            </p>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
              {rows.length} {rows.length === 1 ? "class" : "classes"}
            </span>
          </div>

          <div className="space-y-5">
            {groupedRows.map(([universityName, universityRows]) => (
              <section
                key={universityName}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-4 dark:border-slate-800 dark:from-indigo-900/20 dark:to-blue-900/20">
                  <School size={17} className="text-indigo-600 dark:text-indigo-300" />
                  <h2 className="font-bold text-slate-800 dark:text-slate-100">{universityName}</h2>
                  <span className="ml-auto rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                    {universityRows.length} {universityRows.length === 1 ? "class" : "classes"}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      <tr>
                        <th className="px-5 py-3">Sr#</th>
                        <th className="px-5 py-3">Session</th>
                        <th className="px-5 py-3">Class</th>
                        <th className="px-5 py-3">Semester</th>
                        <th className="px-5 py-3">Start Date</th>
                        <th className="px-5 py-3">Mid-Term Status</th>
                        <th className="px-5 py-3">Conducted Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {universityRows.map((row, index) => (
                        <tr key={row.class_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          <td className="px-5 py-3 text-slate-400">{index + 1}</td>
                          <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">
                            {row.session}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-100">
                            {row.class_name}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                            Semester {row.semester_number}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                            {formatDateOnly(row.start_date)}
                          </td>
                          <td className="px-5 py-3">
                            {row.mid_term_status === "conducted" ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                Conducted
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">
                            {row.mid_term_date ? formatDateOnly(row.mid_term_date) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}