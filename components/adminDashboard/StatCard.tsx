"use client";

import {
  TrendingUp,
  Users,
  Building2,
  Landmark,
  GraduationCap,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

const iconMap = {
  Users,
  Building2,
  Landmark,
  GraduationCap,
  UsersRound,
} satisfies Record<string, LucideIcon>;

export type StatCardIconName = keyof typeof iconMap;

export default function StatCard({
  label,
  value,
  icon,
  gradient,
  hint,
}: {
  label: string;
  value: number | string;
  icon: StatCardIconName;
  gradient: "grad-primary" | "grad-cyan" | "grad-emerald" | "grad-amber" | "grad-rose";
  hint?: string;
}) {
  const Icon = iconMap[icon];
  return (
    <div className="card-3d card-hover group relative overflow-hidden p-5">
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35 ${gradient}`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {value}
          </p>
          {hint && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={12} /> {hint}
            </p>
          )}
        </div>
        <div
          className={`icon-tile h-12 w-12 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${gradient}`}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
