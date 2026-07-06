"use client";

import Link from "next/link";
import {
  UserPlus,
  CalendarPlus,
  ClipboardList,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ACTIONS: {
  label: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
}[] = [
  {
    label: "Add Student",
    href: "/dashboard/admin/students",
    icon: UserPlus,
    gradient: "grad-emerald",
  },
  {
    label: "Start Semester",
    href: "/dashboard/admin/semesters",
    icon: CalendarPlus,
    gradient: "grad-cyan",
  },
  {
    label: "New Allocation",
    href: "/dashboard/admin/allocations",
    icon: ClipboardList,
    gradient: "grad-primary",
  },
  {
    label: "Generate Bill",
    href: "/dashboard/admin/billing",
    icon: Wallet,
    gradient: "grad-amber",
  },
];

export default function QuickActions() {
  return (
    <div className="card-3d card-hover p-5">
      <p className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="card-press group flex flex-col items-start gap-3 rounded-xl border border-slate-900/5 p-3.5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/5"
          >
            <span
              className={`icon-tile h-9 w-9 transition-transform group-hover:scale-110 ${a.gradient}`}
            >
              <a.icon size={16} />
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {a.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
