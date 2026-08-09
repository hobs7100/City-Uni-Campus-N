"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, Search, RefreshCw, Users, CalendarDays,
  TrendingUp, Filter, Eye, X, ChevronRight,
} from "lucide-react";
import { DataFetchLoader } from "@/components/ui/Loaders";

/* ── types ───────────────────────────────────────────────────────────────── */
interface RawRow {
  department_id:   string;
  department_name: string;
  class_id:        string;
  class_name:      string;
  session:         string;
  semester_id:     string;
  semester_number: number;
  term_type:       string;
  active_students: string;
  presents:        string;
  absents:         string;
  leaves:          string;
  marked_days:     string;
}

interface ClassCard extends RawRow {
  active_students_n: number;
  presents_n:        number;
  absents_n:         number;
  leaves_n:          number;
  marked_days_n:     number;
  pct:               number | null;
}

interface Department { id: string; name: string }

/* ── helpers ──────────────────────────────────────────────────────────────── */
function calcPct(presents: number, absents: number): number | null {
  const total = presents + absents;
  return total > 0 ? Math.round((presents / total) * 100 * 10) / 10 : null;
}

function pctTier(pct: number | null): "good" | "warn" | "low" | "none" {
  if (pct === null) return "none";
  if (pct >= 75)   return "good";
  if (pct >= 60)   return "warn";
  return "low";
}

const TIER_STYLES = {
  good: {
    ring:    "ring-emerald-200 dark:ring-emerald-500/30",
    badge:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    bar:     "from-emerald-400 to-emerald-500",
    glow:    "shadow-emerald-100 dark:shadow-emerald-500/10",
    num:     "text-emerald-600 dark:text-emerald-400",
    dot:     "bg-emerald-500",
  },
  warn: {
    ring:    "ring-amber-200 dark:ring-amber-500/30",
    badge:   "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    bar:     "from-amber-400 to-amber-500",
    glow:    "shadow-amber-100 dark:shadow-amber-500/10",
    num:     "text-amber-600 dark:text-amber-400",
    dot:     "bg-amber-500",
  },
  low: {
    ring:    "ring-red-200 dark:ring-red-500/30",
    badge:   "bg-red-500/10 text-red-600 dark:text-red-300",
    bar:     "from-red-400 to-red-500",
    glow:    "shadow-red-100 dark:shadow-red-500/10",
    num:     "text-red-600 dark:text-red-400",
    dot:     "bg-red-500",
  },
  none: {
    ring:    "ring-slate-200 dark:ring-slate-700",
    badge:   "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
    bar:     "from-slate-300 to-slate-400",
    glow:    "shadow-slate-100 dark:shadow-slate-900",
    num:     "text-slate-400 dark:text-slate-500",
    dot:     "bg-slate-300",
  },
};

const DEPT_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-indigo-600",
  "from-teal-500 to-cyan-600",
  "from-rose-500 to-pink-600",
  "from-orange-500 to-amber-600",
];

function deptGradient(idx: number) {
  return DEPT_GRADIENTS[idx % DEPT_GRADIENTS.length];
}

/* ── card component ───────────────────────────────────────────────────────── */
function ClassAttCard({
  card, idx, onShowDetails,
}: {
  card: ClassCard;
  idx: number;
  onShowDetails: (card: ClassCard) => void;
}) {
  const tier    = pctTier(card.pct);
  const styles  = TIER_STYLES[tier];
  const barPct  = card.pct ?? 0;

  return (
    <div
      className={`dept-card card-3d group relative overflow-hidden rounded-2xl bg-white p-5
        ring-2 ${styles.ring} ${styles.glow} shadow-lg
        dark:bg-slate-900`}
      style={{ animationDelay: `${idx * 60}ms` }}
    >
      {/* top-right status dot */}
      <span className={`absolute right-4 top-4 h-2.5 w-2.5 rounded-full ${styles.dot} shadow-sm`} />

      {/* class + semester */}
      <div className="mb-3 pr-5">
        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
          {card.class_name}
        </p>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          {card.session} &middot; Sem {card.semester_number}
          {card.term_type && card.term_type !== "regular"
            ? ` (${card.term_type})`
            : ""}
        </p>
      </div>

      {/* big percentage */}
      <div className="mb-3 flex items-end gap-2">
        <span className={`text-4xl font-extrabold leading-none tabular-nums ${styles.num}`}>
          {card.pct !== null ? `${card.pct}%` : "—"}
        </span>
        {card.pct !== null && (
          <span className={`mb-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles.badge}`}>
            {tier === "good" ? "On Track" : tier === "warn" ? "At Risk" : "Critical"}
          </span>
        )}
      </div>

      {/* progress bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${styles.bar}`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* stats row: students + days only */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
          <Users size={12} className="shrink-0 text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{card.active_students_n}</span> students
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
          <CalendarDays size={12} className="shrink-0 text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{card.marked_days_n}</span> days
          </span>
        </div>
      </div>

      {/* Show Details button */}
      <button
        onClick={() => onShowDetails(card)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
      >
        <Eye size={12} /> Show Details <ChevronRight size={11} className="ml-auto" />
      </button>

      {/* subtle gradient overlay on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 to-white/0 transition-all duration-300 group-hover:from-indigo-50/20 group-hover:to-purple-50/20 dark:group-hover:from-indigo-900/10 dark:group-hover:to-purple-900/10" />
    </div>
  );
}

interface DetailRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  presents: number;
  absents: number;
  leaves: number;
  percentage: number | null;
}

/* ── main component ───────────────────────────────────────────────────────── */
export default function DeptAttendanceManager({ role }: { role: "admin" | "hod" }) {
  const [cards,       setCards]       = useState<ClassCard[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [fetched,     setFetched]     = useState(false);

  // filters
  const [search,     setSearch]     = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "good" | "warn" | "low" | "none">("all");

  // details panel
  const [detailsCard,    setDetailsCard]    = useState<ClassCard | null>(null);
  const [detailsRows,    setDetailsRows]    = useState<DetailRow[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const endpoint = role === "admin" ? "/api/admin/dept-attendance" : "/api/hod/dept-attendance";

  const loadDetails = useCallback(async (card: ClassCard) => {
    setDetailsCard(card);
    setDetailsRows([]);
    setDetailsLoading(true);
    try {
      const res  = await fetch(
        `/api/admin/dept-attendance-details?class_id=${card.class_id}&semester_id=${card.semester_id}`
      );
      const data = await res.json();
      if (res.ok) setDetailsRows(data.students ?? []);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      if (role === "admin" && deptFilter) url.searchParams.set("department_id", deptFilter);
      const res  = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) return;
      const raw: RawRow[] = data.rows ?? [];
      setCards(raw.map((r) => {
        const p  = Number(r.presents);
        const a  = Number(r.absents);
        const l  = Number(r.leaves);
        const md = Number(r.marked_days);
        const as_ = Number(r.active_students);
        return {
          ...r,
          active_students_n: as_,
          presents_n:  p,
          absents_n:   a,
          leaves_n:    l,
          marked_days_n: md,
          pct: calcPct(p, a),
        };
      }));
      if (data.departments) setDepartments(data.departments);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }, [endpoint, role, deptFilter]);

  useEffect(() => { load(); }, [load]);

  /* filtered + grouped cards */
  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.class_name.toLowerCase().includes(q) &&
            !c.session.toLowerCase().includes(q) &&
            !c.department_name.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && pctTier(c.pct) !== statusFilter) return false;
      return true;
    });
  }, [cards, search, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { dept: { id: string; name: string }; cards: ClassCard[] }>();
    for (const c of filtered) {
      if (!map.has(c.department_id)) {
        map.set(c.department_id, { dept: { id: c.department_id, name: c.department_name }, cards: [] });
      }
      map.get(c.department_id)!.cards.push(c);
    }
    return Array.from(map.values());
  }, [filtered]);

  /* summary counters */
  const summary = useMemo(() => {
    const total   = cards.length;
    const good    = cards.filter((c) => pctTier(c.pct) === "good").length;
    const warn    = cards.filter((c) => pctTier(c.pct) === "warn").length;
    const low     = cards.filter((c) => pctTier(c.pct) === "low").length;
    const noData  = cards.filter((c) => pctTier(c.pct) === "none").length;
    const avgPct  = (() => {
      const withPct = cards.filter((c) => c.pct !== null);
      if (!withPct.length) return null;
      return Math.round(withPct.reduce((s, c) => s + c.pct!, 0) / withPct.length * 10) / 10;
    })();
    return { total, good, warn, low, noData, avgPct };
  }, [cards]);

  /* card-index counter across all groups for stagger */
  let globalIdx = 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* keyframe injection */}
      <style>{`
        @keyframes deptCardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        .dept-card { animation: deptCardIn 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      {/* ── page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl grad-primary shadow-lg shadow-indigo-500/25">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Departmental Attendance
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Coordinator-marked · Active semesters only
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600
            hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700
            disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── summary cards ───────────────────────────────────────────────── */}
      {fetched && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {[
            { label: "Total Classes",  value: summary.total,   color: "text-slate-700 dark:text-slate-200",  bg: "bg-slate-50 dark:bg-slate-800/60",   border: "border-slate-200 dark:border-slate-700" },
            { label: "≥ 75% (On Track)", value: summary.good,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/30" },
            { label: "60–74% (At Risk)", value: summary.warn,   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-500/10",   border: "border-amber-200 dark:border-amber-500/30" },
            { label: "< 60% (Critical)", value: summary.low,    color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-500/10",       border: "border-red-200 dark:border-red-500/30" },
            { label: "Avg. Attendance", value: summary.avgPct !== null ? `${summary.avgPct}%` : "—", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-200 dark:border-indigo-500/30" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg} ${s.border}`}>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── filter bar ──────────────────────────────────────────────────── */}
      <div className="card-3d flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search class, session, department…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm
              focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20
              dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* dept filter — admin only */}
        {role === "admin" && departments.length > 0 && (
          <div className="flex items-center gap-2">
            <Building2 size={14} className="shrink-0 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
                focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20
                dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* status filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="shrink-0 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm
              focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20
              dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="good">≥ 75% (On Track)</option>
            <option value="warn">60–74% (At Risk)</option>
            <option value="low">&lt; 60% (Critical)</option>
            <option value="none">No Data</option>
          </select>
        </div>
      </div>

      {/* ── loading ─────────────────────────────────────────────────────── */}
      {loading && <DataFetchLoader />}

      {/* ── empty state ─────────────────────────────────────────────────── */}
      {!loading && fetched && filtered.length === 0 && (
        <div className="card-3d flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
          <TrendingUp size={40} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {cards.length === 0
              ? "No active semester attendance data found."
              : "No classes match the current filters."}
          </p>
        </div>
      )}

      {/* ── details modal ────────────────────────────────────────────────── */}
      {detailsCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setDetailsCard(null)}>
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50 px-6 py-4 dark:border-slate-800 dark:bg-indigo-900/20">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">
                  {detailsCard.class_name} — Coordinator Attendance
                </h3>
                <p className="text-xs text-slate-500">
                  {detailsCard.session} · Sem {detailsCard.semester_number} · {detailsCard.department_name}
                </p>
              </div>
              <button onClick={() => setDetailsCard(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {detailsLoading ? (
                <div className="p-8"><DataFetchLoader /></div>
              ) : detailsRows.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">No attendance records found for this class.</p>
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/90 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3 text-center">Present</th>
                      <th className="px-4 py-3 text-center">Absent</th>
                      <th className="px-4 py-3 text-center">Leave</th>
                      <th className="px-4 py-3 text-center">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {detailsRows.map((r, i) => {
                      const pct = r.percentage;
                      const pctCls = pct === null ? "text-slate-400"
                        : pct >= 75 ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : pct >= 60 ? "text-amber-600 dark:text-amber-400 font-semibold"
                        : "text-red-600 dark:text-red-400 font-bold";
                      return (
                        <tr key={r.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                            <div className="text-xs text-slate-400">{r.roll_no || "—"}</div>
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">{r.presents}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-red-500">{r.absents}</td>
                          <td className="px-4 py-2.5 text-center text-amber-500">{r.leaves}</td>
                          <td className={`px-4 py-2.5 text-center ${pctCls}`}>
                            {pct !== null ? `${pct}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-slate-100 px-6 py-3 text-right dark:border-slate-800">
              <span className="text-xs text-slate-400">{detailsRows.length} student{detailsRows.length !== 1 ? "s" : ""} · Coordinator-marked attendance</span>
            </div>
          </div>
        </div>
      )}

      {/* ── grouped cards ───────────────────────────────────────────────── */}
      {!loading && grouped.map((group, gIdx) => {
        const grad = deptGradient(gIdx);
        return (
          <section key={group.dept.id} className="space-y-4">
            {/* department header */}
            <div className={`flex items-center gap-3 rounded-xl bg-gradient-to-r ${grad} px-5 py-3.5 shadow-md`}>
              <Building2 size={18} className="shrink-0 text-white/90" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-white">
                  {group.dept.name}
                </h2>
                <p className="text-[11px] text-white/70">
                  {group.cards.length} class{group.cards.length !== 1 ? "es" : ""} · Active semester attendance
                </p>
              </div>
              {/* dept avg */}
              {(() => {
                const withPct = group.cards.filter((c) => c.pct !== null);
                if (!withPct.length) return null;
                const avg = Math.round(withPct.reduce((s, c) => s + c.pct!, 0) / withPct.length * 10) / 10;
                return (
                  <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm">
                    Avg {avg}%
                  </span>
                );
              })()}
            </div>

            {/* class cards grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.cards.map((card) => (
                <ClassAttCard
                  key={card.class_id}
                  card={card}
                  idx={globalIdx++}
                  onShowDetails={loadDetails}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
