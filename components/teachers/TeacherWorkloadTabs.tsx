"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Search } from "lucide-react";
import { DataFetchLoader } from "@/components/ui/Loaders";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RawRow {
  teacher_id: string;
  teacher_name: string;
  department_id: string;
  department_name: string;
  type: "permanent" | "visiting";
  workload_decided: string | null;
  allocation_id: string | null;
  course_code: string | null;
  course_title: string | null;
  credit_hours: string | null;
  class_name: string | null;
  session: string | null;
  semester_id: string | null;
  result_uploaded: boolean;
}

interface CourseEntry {
  allocation_id: string;
  course_code: string;
  course_title: string;
  credit_hours: number;
  class_name: string;
  session: string;
  result_uploaded: boolean;
}

interface TeacherGroup {
  teacher_id: string;
  teacher_name: string;
  department_id: string;
  department_name: string;
  type: "permanent" | "visiting";
  workload_decided: number | null;
  workload_assigned: number;
  courses: CourseEntry[];
}

type WorkloadStatus = "all" | "overload" | "underload" | "complete";

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupRows(rows: RawRow[]): TeacherGroup[] {
  const map = new Map<string, TeacherGroup>();

  for (const r of rows) {
    if (!map.has(r.teacher_id)) {
      map.set(r.teacher_id, {
        teacher_id: r.teacher_id,
        teacher_name: r.teacher_name,
        department_id: r.department_id,
        department_name: r.department_name,
        type: r.type,
        workload_decided: r.workload_decided ? Number(r.workload_decided) : null,
        workload_assigned: 0,
        courses: [],
      });
    }
    const group = map.get(r.teacher_id)!;

    if (r.allocation_id && r.course_title && r.class_name) {
      // Avoid duplicating the same (allocation_id, class_name, session) row
      const already = group.courses.find(
        (c) => c.allocation_id === r.allocation_id && c.class_name === r.class_name && c.session === r.session
      );
      if (!already) {
        group.courses.push({
          allocation_id: r.allocation_id,
          course_code: r.course_code ?? "",
          course_title: r.course_title,
          credit_hours: r.credit_hours ? Number(r.credit_hours) : 0,
          class_name: r.class_name,
          session: r.session ?? "",
          result_uploaded: r.result_uploaded,
        });
      }
    }
  }

  // Compute workload_assigned: sum credit_hours per distinct allocation_id.
  // Each allocation (even combined lectures that span multiple classes) counts once.
  for (const group of map.values()) {
    const allocSeen = new Set<string>();
    let total = 0;
    for (const c of group.courses) {
      if (!allocSeen.has(c.allocation_id)) {
        allocSeen.add(c.allocation_id);
        total += c.credit_hours;
      }
    }
    group.workload_assigned = total;
  }

  return Array.from(map.values());
}

function workloadStatus(group: TeacherGroup): "overload" | "underload" | "complete" | null {
  if (group.type !== "permanent" || group.workload_decided == null) return null;
  if (group.workload_assigned > group.workload_decided) return "overload";
  if (group.workload_assigned < group.workload_decided) return "underload";
  return "complete";
}

function WorkloadBadge({ group }: { group: TeacherGroup }) {
  const st = workloadStatus(group);
  if (!st) return null;
  const map: Record<string, string> = {
    overload: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    underload: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    complete: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  };
  const labels: Record<string, string> = {
    overload: "Overload",
    underload: "Underload",
    complete: "Complete",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[st]}`}>
      {labels[st]}
    </span>
  );
}

function ResultBadge({ uploaded }: { uploaded: boolean }) {
  return uploaded ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
      Uploaded
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
      Pending
    </span>
  );
}

// ── Teacher Card ───────────────────────────────────────────────────────────────

function TeacherCard({ group }: { group: TeacherGroup }) {
  const [open, setOpen] = useState(true);
  const st = workloadStatus(group);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {/* Avatar letter */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-sm font-bold text-white">
            {group.teacher_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate">{group.teacher_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{group.department_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            {group.type === "permanent" && group.workload_decided != null && (
              <>
                <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  Decided: <strong>{group.workload_decided} CH</strong>
                </span>
                <span
                  className={`rounded px-2 py-0.5 ${
                    st === "overload"
                      ? "bg-orange-50 dark:bg-orange-500/10"
                      : st === "underload"
                      ? "bg-red-50 dark:bg-red-500/10"
                      : "bg-emerald-50 dark:bg-emerald-500/10"
                  }`}
                >
                  Assigned: <strong>{group.workload_assigned} CH</strong>
                </span>
              </>
            )}
            {group.type === "visiting" && (
              <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                Assigned: <strong>{group.workload_assigned} CH</strong>
              </span>
            )}
            {group.type === "permanent" && <WorkloadBadge group={group} />}
          </div>
        </div>
        <div className="shrink-0 text-slate-400">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Course rows */}
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {group.courses.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400 italic">No active course allocations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Course</th>
                    <th className="px-4 py-2 text-left">Class</th>
                    <th className="px-4 py-2 text-left">Session</th>
                    <th className="px-4 py-2 text-center">Credit Hours</th>
                    <th className="px-4 py-2 text-center">Result Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.courses.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</p>
                        {c.course_code && (
                          <p className="text-[11px] text-slate-400">{c.course_code}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.class_name}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{c.session}</td>
                      <td className="px-4 py-2.5 text-center font-medium text-slate-700 dark:text-slate-200">
                        {c.credit_hours}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <ResultBadge uploaded={c.result_uploaded} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  apiEndpoint: string;
  initialSubTab?: "permanent" | "visiting";
}

export default function TeacherWorkloadTabs({ apiEndpoint, initialSubTab = "permanent" }: Props) {
  const [subTab, setSubTab] = useState<"permanent" | "visiting">(initialSubTab);
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WorkloadStatus>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiEndpoint);
      const data = await res.json();
      if (res.ok) {
        setGroups(groupRows(data.rows ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    load();
  }, [load]);

  // Departments for filter dropdown
  const departments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of groups) seen.set(g.department_id, g.department_name);
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [groups]);

  const filtered = useMemo(() => {
    return groups
      .filter((g) => g.type === subTab)
      .filter((g) => (deptFilter === "all" ? true : g.department_id === deptFilter))
      .filter((g) => (search.trim() ? g.teacher_name.toLowerCase().includes(search.toLowerCase()) : true))
      .filter((g) => {
        if (statusFilter === "all") return true;
        return workloadStatus(g) === statusFilter;
      });
  }, [groups, subTab, deptFilter, search, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-fit dark:border-slate-700 dark:bg-slate-900">
        {(["permanent", "visiting"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setSubTab(t); setStatusFilter("all"); setSearch(""); setDeptFilter("all"); }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all ${
              subTab === t
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search teacher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Department filter */}
        {departments.length > 1 && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Departments</option>
            {departments.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        {/* Workload status filter (permanent only) */}
        {subTab === "permanent" && (
          <div className="flex flex-wrap gap-1.5">
            {(["all", "overload", "underload", "complete"] as WorkloadStatus[]).map((s) => {
              const colorMap: Record<WorkloadStatus, string> = {
                all: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200",
                overload: "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-500/20 dark:text-orange-300",
                underload: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-400",
                complete: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300",
              };
              const activeMap: Record<WorkloadStatus, string> = {
                all: "ring-2 ring-slate-400",
                overload: "ring-2 ring-orange-400",
                underload: "ring-2 ring-red-400",
                complete: "ring-2 ring-emerald-400",
              };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all ${colorMap[s]} ${statusFilter === s ? activeMap[s] : ""}`}
                >
                  {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <DataFetchLoader />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <BookOpen size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">
            No {subTab} teachers found{search || deptFilter !== "all" || statusFilter !== "all" ? " matching the current filters" : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{filtered.length} teacher{filtered.length !== 1 ? "s" : ""}</p>
          {filtered.map((g) => (
            <TeacherCard key={g.teacher_id} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
