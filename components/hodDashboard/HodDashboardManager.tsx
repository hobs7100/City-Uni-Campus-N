"use client";

import { useEffect, useState } from "react";
import { Building2, FileDown, GraduationCap, Loader2, UsersRound } from "lucide-react";
import { formatDateOnly } from "@/lib/format";

interface Department {
  id: string;
  name: string;
}

interface Counters {
  total_classes: string;
  total_students: string;
  active: string;
  left: string;
  dropped: string;
  freezed: string;
  struck_off: string;
}

interface ClassRow {
  id: string;
  class_name: string;
  session: string;
  university_name: string | null;
  total_students: string;
  active_students: string;
  struck_off: string;
}

export default function HodDashboardManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hod/overview")
      .then((r) => r.json())
      .then((d) => {
        setDepartments(d.departments);
        setCounters(d.counters);
        setClasses(d.classes);
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = counters
    ? [
        { label: "Total Classes", value: Number(counters.total_classes), icon: Building2, color: "bg-sky-500" },
        { label: "Total Students", value: Number(counters.total_students), icon: GraduationCap, color: "bg-emerald-500" },
        { label: "Active", value: Number(counters.active), icon: UsersRound, color: "bg-indigo-500" },
        { label: "Left", value: Number(counters.left), icon: UsersRound, color: "bg-slate-500" },
        { label: "Dropped", value: Number(counters.dropped), icon: UsersRound, color: "bg-amber-500" },
        { label: "Freezed", value: Number(counters.freezed), icon: UsersRound, color: "bg-cyan-500" },
        { label: "Struck Off", value: Number(counters.struck_off), icon: UsersRound, color: "bg-red-500" },
      ]
    : [];

  if (loading) {
    return <Loader2 className="mx-auto mt-20 animate-spin text-slate-400" />;
  }

  if (departments.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You are not yet assigned as Head of Department for any department. Please contact the administrator.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {departments.map((d) => d.name).join(", ")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Department overview</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FileDown size={16} /> Export PDF
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 print:hidden sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.color} text-white`}>
                <c.icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{c.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white print:hidden dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">University</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Struck Off</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {classes.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No classes found.</td></tr>
            ) : (
              classes.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.class_name}</td>
                  <td className="px-4 py-3">{c.session}</td>
                  <td className="px-4 py-3">{c.university_name || "—"}</td>
                  <td className="px-4 py-3">{c.active_students}</td>
                  <td className="px-4 py-3">{c.struck_off}</td>
                  <td className="px-4 py-3">{c.total_students}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="hidden print:block">
        <div className="mb-3 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-3 text-center text-white">
          <h2 className="text-lg font-extrabold tracking-wide">City College (University Campus)</h2>
          <p className="text-xs font-semibold opacity-90">Department Overview — {departments.map((d) => d.name).join(", ")}</p>
          <p className="text-[10px] opacity-80">Generated: {formatDateOnly(new Date().toISOString())}</p>
        </div>
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="border border-indigo-400 px-1.5 py-0.5">Class</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Session</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">University</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Active</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Struck Off</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c, idx) => (
              <tr key={c.id} className={idx % 2 === 0 ? "bg-indigo-50/60" : "bg-white"}>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.class_name}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.session}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.university_name || "—"}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.active_students}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.struck_off}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.total_students}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
