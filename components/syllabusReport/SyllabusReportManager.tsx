"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookCheck,
  Building2,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { DataFetchLoader } from "@/components/ui/Loaders";

interface SemesterOption {
  id: string;
  department_id: string;
  department_name: string;
  class_id: string;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
}

interface ReportRow extends SemesterOption {
  course_id: string;
  course_code: string;
  course_title: string;
  teacher_name: string | null;
  credit_hours: string;
  allowed_lectures: string;
  delivered_lectures: string;
}

interface ReportGroup {
  key: string;
  departmentName: string;
  className: string;
  session: string;
  semesterNumber: number;
  termType: string;
  rows: ReportRow[];
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function DeliveryStatus({ delivered, allowed }: { delivered: number; allowed: number }) {
  const percentage = allowed > 0 ? (delivered / allowed) * 100 : 0;
  const colors =
    percentage >= 100
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : percentage >= 75
        ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
        : percentage >= 50
          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
          : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  return (
    <div className="min-w-[145px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {formatNumber(delivered)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${colors}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full ${
            percentage >= 100
              ? "bg-emerald-500"
              : percentage >= 75
                ? "bg-sky-500"
                : percentage >= 50
                  ? "bg-amber-500"
                  : "bg-rose-500"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function SyllabusReportManager() {
  const [semesterId, setSemesterId] = useState("");
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (selectedSemesterId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSemesterId) params.set("semester_id", selectedSemesterId);
      const response = await fetch(`/api/admin/syllabus-report?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Unable to load the syllabus report.");
        return;
      }
      setSemesters(data.semesters ?? []);
      setRows(data.rows ?? []);
    } catch {
      toast.error("Unable to load the syllabus report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(semesterId);
  }, [load, semesterId]);

  const groups = useMemo<ReportGroup[]>(() => {
    const grouped = new Map<string, ReportGroup>();
    for (const row of rows) {
      const key = `${row.department_id}:${row.class_id}:${row.id}`;
      const current = grouped.get(key);
      if (current) {
        current.rows.push(row);
      } else {
        grouped.set(key, {
          key,
          departmentName: row.department_name,
          className: row.class_name,
          session: row.session,
          semesterNumber: row.semester_number,
          termType: row.term_type,
          rows: [row],
        });
      }
    }
    return Array.from(grouped.values());
  }, [rows]);

  const totals = useMemo(() => {
    const allowed = rows.reduce((sum, row) => sum + Number(row.allowed_lectures), 0);
    const delivered = rows.reduce((sum, row) => sum + Number(row.delivered_lectures), 0);
    return {
      courses: rows.length,
      teachers: new Set(rows.map((row) => row.teacher_name).filter(Boolean)).size,
      allowed,
      delivered,
      percentage: allowed > 0 ? (delivered / allowed) * 100 : 0,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur">
              <BookCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">Syllabus Report</h1>
              <p className="mt-1 text-sm text-indigo-100">
                Track allowed and delivered lectures across every active semester
              </p>
            </div>
          </div>
          <div className="w-full lg:w-[430px]">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-indigo-100">
              Class + Session + Active Semester
            </label>
            <div className="flex gap-2">
              <select
                value={semesterId}
                onChange={(event) => setSemesterId(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-white/25 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-white/30 focus:ring-2"
              >
                <option value="">All active semesters</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.class_name} — {semester.session} — Semester {semester.semester_number} ({semester.term_type})
                  </option>
                ))}
              </select>
              <button
                onClick={() => load(semesterId)}
                disabled={loading}
                title="Refresh report"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-50"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Courses", value: totals.courses, icon: BookCheck, color: "from-indigo-500 to-blue-500" },
            { label: "Teachers", value: totals.teachers, icon: UserRound, color: "from-violet-500 to-purple-500" },
            { label: "Lectures Delivered", value: formatNumber(totals.delivered), icon: CheckCircle2, color: "from-emerald-500 to-teal-500" },
            { label: "Overall Progress", value: `${totals.percentage.toFixed(1)}%`, icon: TrendingUp, color: "from-amber-500 to-orange-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white`}>
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-white">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <DataFetchLoader label="Preparing syllabus report…" />
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center dark:border-slate-700 dark:bg-slate-900">
          <BookCheck size={44} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-slate-600 dark:text-slate-300">No courses found</p>
          <p className="mt-1 text-sm text-slate-400">No syllabus courses are attached to the selected active semester.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group, groupIndex) => (
            <section key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className={`flex flex-col gap-3 bg-gradient-to-r p-4 text-white sm:flex-row sm:items-center sm:justify-between ${
                groupIndex % 3 === 0
                  ? "from-indigo-600 to-blue-500"
                  : groupIndex % 3 === 1
                    ? "from-violet-600 to-fuchsia-500"
                    : "from-emerald-600 to-teal-500"
              }`}>
                <div className="flex items-center gap-3">
                  <Building2 size={20} />
                  <div>
                    <h2 className="font-extrabold">{group.departmentName}</h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85">
                      <span className="flex items-center gap-1"><GraduationCap size={12} /> {group.className} · {group.session}</span>
                      <span className="flex items-center gap-1"><CalendarRange size={12} /> Semester {group.semesterNumber} · {group.termType}</span>
                    </div>
                  </div>
                </div>
                <span className="self-start rounded-full bg-white/20 px-3 py-1 text-xs font-bold sm:self-auto">
                  {group.rows.length} course{group.rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-center">Sr#</th>
                      <th className="px-4 py-3 text-left">Course Title</th>
                      <th className="px-4 py-3 text-left">Teacher Name</th>
                      <th className="px-4 py-3 text-center">Credit Hours</th>
                      <th className="px-4 py-3 text-center">Allowed Lectures</th>
                      <th className="px-4 py-3 text-left">Delivered Lectures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.rows.map((row, index) => {
                      const allowed = Number(row.allowed_lectures);
                      const delivered = Number(row.delivered_lectures);
                      return (
                        <tr key={row.course_id} className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5">
                          <td className="px-4 py-4 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{row.course_title}</p>
                            <p className="mt-0.5 text-xs font-semibold text-indigo-500">{row.course_code}</p>
                          </td>
                          <td className="px-4 py-4">
                            {row.teacher_name ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                                <UserRound size={12} /> {row.teacher_name}
                              </span>
                            ) : (
                              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                                Not assigned
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="rounded-lg bg-sky-100 px-2.5 py-1 font-bold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                              {formatNumber(Number(row.credit_hours))}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                            {formatNumber(allowed)}
                          </td>
                          <td className="px-4 py-4">
                            <DeliveryStatus delivered={delivered} allowed={allowed} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}