"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Filter,
  Landmark,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

type Transaction = {
  id: string;
  student_name: string;
  father_name: string | null;
  department_name: string;
  class_name: string;
  session: string;
  semester_number: number;
  amount: string;
  fid: string;
  paid_date: string | null;
  reactivated_on: string | null;
  created_by_name: string | null;
  transaction_date?: string;
};

type FineData = {
  transactions: Transaction[];
  stats: {
    total_fine_amount: string;
    current_month_fine_amount: string;
    current_struck_off_students: number;
  };
  monthly_totals: { year: number; month: number; total_amount: string }[];
  yearly_totals: { year: number; total_amount: string }[];
  filter_options: {
    departments: { id: string; name: string }[];
    classes: { id: string; name: string; session: string; department_id: string }[];
    sessions: string[];
    semester_numbers: number[];
    years: number[];
    months: number[];
    fids: string[];
  };
};

type Filters = {
  search: string;
  department_id: string;
  class_id: string;
  session: string;
  semester_number: string;
  year: string;
  month: string;
  fid: string;
};

const initialFilters: Filters = {
  search: "",
  department_id: "",
  class_id: "",
  session: "",
  semester_number: "",
  year: "",
  month: "",
  fid: "",
};

const money = (value: string | number) =>
  `PKR ${Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

const dateLabel = (value: string | null | undefined) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const monthLabel = (month: number) =>
  new Date(2024, month - 1, 1).toLocaleDateString("en-US", { month: "short" });

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="group relative block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white/80 px-3 pr-8 text-sm font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
      </span>
    </label>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone: "teal" | "coral" | "violet";
  trend?: string;
}) {
  const styles = {
    teal: "from-[#0f766e] to-[#14b8a6] shadow-teal-900/20",
    coral: "from-[#c2415b] to-[#f97366] shadow-rose-900/20",
    violet: "from-[#4338ca] to-[#7c3aed] shadow-indigo-900/20",
  }[tone];
  return (
    <div className={`relative min-h-[158px] overflow-hidden rounded-[24px] bg-gradient-to-br ${styles} p-5 text-white shadow-xl`}>
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-white/10" />
      <div className="absolute -bottom-10 right-8 h-24 w-24 rounded-full border-[12px] border-white/10" />
      <div className="relative flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
          <Icon className="h-5 w-5" />
        </span>
        {trend && (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">{trend}</span>
        )}
      </div>
      <div className="relative mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/70">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-white/70">{detail}</p>
      </div>
    </div>
  );
}

export default function FinesManager() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [data, setData] = useState<FineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const updateFilter = (key: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value, ...(key === "department_id" ? { class_id: "" } : {}) }));

  const loadFines = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      const response = await fetch(`/api/admin/fines?${params.toString()}`, { credentials: "include" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load fine transactions.");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load fine transactions.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeout = window.setTimeout(loadFines, 220);
    return () => window.clearTimeout(timeout);
  }, [loadFines]);

  const classes = useMemo(
    () => data?.filter_options.classes.filter((item) => !filters.department_id || item.department_id === filters.department_id) ?? [],
    [data, filters.department_id],
  );
  const clearFilters = () => setFilters(initialFilters);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <main className="min-h-[100dvh] bg-[#f6f8f7] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <header className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">
              <span className="h-2 w-2 rounded-full bg-coral-500" />
              Revenue control / struck-off reactivation
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">Fine ledger</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Reconcile reactivation payments, monitor recovery momentum, and keep every student account traceable.
            </p>
          </div>
          <button
            type="button"
            onClick={loadFines}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh ledger
          </button>
        </header>

        {error ? (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <span className="flex items-center gap-3"><AlertCircle className="h-5 w-5" />{error}</span>
            <button type="button" onClick={loadFines} className="font-bold underline">Retry</button>
          </div>
        ) : null}

        <section className="mb-7 grid gap-4 md:grid-cols-3">
          <StatCard label="Total recovered" value={loading ? "—" : money(data?.stats.total_fine_amount ?? 0)} detail="Across the selected ledger view" icon={CircleDollarSign} tone="teal" trend="All time" />
          <StatCard label="This month" value={loading ? "—" : money(data?.stats.current_month_fine_amount ?? 0)} detail="Current-month reactivation payments" icon={ArrowUpRight} tone="coral" trend="Live" />
          <StatCard label="Students awaiting recovery" value={loading ? "—" : Number(data?.stats.current_struck_off_students ?? 0).toLocaleString()} detail="Currently marked struck off" icon={Users} tone="violet" trend="Attention" />
        </section>

        <section className="mb-7 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Filter className="h-4 w-4" /></span>
              <div><h2 className="text-sm font-extrabold text-slate-900">Narrow the ledger</h2><p className="text-xs text-slate-400">Every filter updates the totals below</p></div>
            </div>
            {hasFilters && <button type="button" onClick={clearFilters} className="text-xs font-bold text-teal-700 hover:text-teal-900">Clear all filters</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="sm:col-span-2 xl:col-span-2">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Search student / FID</span>
              <span className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Name, father or FID" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10" /></span>
            </label>
            <SelectField label="Faculty" value={filters.department_id} onChange={(value) => updateFilter("department_id", value)}><option value="">All faculties</option>{data?.filter_options.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <SelectField label="Class" value={filters.class_id} onChange={(value) => updateFilter("class_id", value)}><option value="">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.session}</option>)}</SelectField>
            <SelectField label="Session" value={filters.session} onChange={(value) => updateFilter("session", value)}><option value="">All sessions</option>{data?.filter_options.sessions.map((item) => <option key={item}>{item}</option>)}</SelectField>
            <SelectField label="Semester" value={filters.semester_number} onChange={(value) => updateFilter("semester_number", value)}><option value="">All semesters</option>{data?.filter_options.semester_numbers.map((item) => <option key={item} value={item}>Semester {item}</option>)}</SelectField>
            <SelectField label="Year" value={filters.year} onChange={(value) => updateFilter("year", value)}><option value="">All years</option>{data?.filter_options.years.map((item) => <option key={item}>{item}</option>)}</SelectField>
            <SelectField label="Month" value={filters.month} onChange={(value) => updateFilter("month", value)}><option value="">All months</option>{data?.filter_options.months.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}</SelectField>
            <SelectField label="Fine ID" value={filters.fid} onChange={(value) => updateFilter("fid", value)}><option value="">All FIDs</option>{data?.filter_options.fids.map((item) => <option key={item}>{item}</option>)}</SelectField>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-[24px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><h2 className="text-base font-extrabold">Payment transactions</h2><p className="mt-0.5 text-xs text-slate-400">{data?.transactions.length ?? 0} records in this view</p></div>
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:flex"><CheckCircle2 className="h-3.5 w-3.5" /> Reconciled view</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#f8faf9] text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3 font-bold">Student / FID</th><th className="px-4 py-3 font-bold">Academic placement</th><th className="px-4 py-3 font-bold">Paid on</th><th className="px-4 py-3 font-bold">Reactivated</th><th className="px-5 py-3 text-right font-bold">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? Array.from({ length: 5 }).map((_, index) => <tr key={index}><td colSpan={5} className="px-5 py-5"><div className="h-5 animate-pulse rounded-lg bg-slate-100" /></td></tr>) : data?.transactions.length ? data.transactions.map((item) => <tr key={item.id} className="transition hover:bg-teal-50/30"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xs font-black text-teal-700">{item.student_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><p className="font-bold text-slate-800">{item.student_name}</p><p className="mt-0.5 text-xs text-slate-400">{item.fid} · {item.father_name || "Father not listed"}</p></div></div></td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{item.class_name}</p><p className="mt-0.5 text-xs text-slate-400">{item.department_name} · {item.session} · Sem {item.semester_number}</p></td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{dateLabel(item.paid_date || item.transaction_date)}</td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{dateLabel(item.reactivated_on)}</td><td className="whitespace-nowrap px-5 py-4 text-right font-black text-teal-700">{money(item.amount)}</td></tr>) : <tr><td colSpan={5} className="px-5 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Search className="h-5 w-5" /></div><p className="mt-3 font-bold text-slate-700">No transactions match these filters</p><p className="mt-1 text-sm text-slate-400">Try widening the search or clearing a filter.</p></td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-extrabold">Monthly pulse</h2><p className="text-xs text-slate-400">Recovery by payment month</p></div><CalendarDays className="h-5 w-5 text-teal-600" /></div>
              <div className="space-y-3">{data?.monthly_totals.slice(0, 8).map((item, index) => { const max = Math.max(...(data.monthly_totals.map((row) => Number(row.total_amount))), 1); return <div key={`${item.year}-${item.month}`}><div className="mb-1.5 flex justify-between text-xs"><span className="font-bold text-slate-600">{monthLabel(item.month)} {item.year}</span><span className="font-black text-slate-800">{money(item.total_amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div style={{ width: `${Math.max((Number(item.total_amount) / max) * 100, 5)}%` }} className={`h-full rounded-full ${index === 0 ? "bg-teal-500" : "bg-teal-200"}`} /></div></div> })}</div>
              {!data?.monthly_totals.length && <p className="py-6 text-center text-sm text-slate-400">No monthly totals available.</p>}
            </section>
            <section className="rounded-[24px] border border-slate-200/80 bg-slate-900 p-5 text-white shadow-[0_12px_40px_rgba(15,23,42,0.15)]">
              <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Landmark className="h-4 w-4 text-amber-300" /></span><div><h2 className="text-base font-extrabold">Yearly close</h2><p className="text-xs text-slate-400">Annual reconciliation totals</p></div></div>
              <div className="divide-y divide-white/10">{data?.yearly_totals.map((item, index) => <div key={item.year} className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-sm font-bold text-slate-300"><span className="text-xs text-slate-500">0{index + 1}</span>{item.year}</span><span className="text-sm font-black text-amber-300">{money(item.total_amount)}</span></div>)}</div>
              {!data?.yearly_totals.length && <p className="py-4 text-sm text-slate-400">No yearly totals available.</p>}
            </section>
          </aside>
        </div>
        <footer className="mt-7 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-teal-600" /> Fine records are read-only here and sourced from the campus finance ledger.</footer>
      </div>
    </main>
  );
}