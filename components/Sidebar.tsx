"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  Landmark,
  Building2,
  School,
  UsersRound,
  BookOpen,
  CalendarRange,
  ClipboardList,
  CalendarClock,
  UserCheck,
  ClipboardCheck,
  Wallet,
  Award,
  type LucideIcon,
} from "lucide-react";
import type { NavItem, NavIconName } from "@/lib/nav";

const iconMap: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Users,
  Landmark,
  Building2,
  School,
  GraduationCap,
  UsersRound,
  BookOpen,
  CalendarRange,
  ClipboardList,
  CalendarClock,
  UserCheck,
  ClipboardCheck,
  Wallet,
  Award,
};

export default function Sidebar({
  items,
  open,
  onNavigate,
}: {
  items: NavItem[];
  open: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto glass-panel transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        borderRight: "1px solid var(--surface-border)",
        borderTop: "none",
        borderBottom: "none",
        borderLeft: "none",
      }}
    >
      <div
        className="flex h-16 items-center gap-2.5 border-b px-5"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div className="icon-tile grad-primary h-10 w-10 shrink-0">
          <GraduationCap size={20} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900 dark:text-white">City College</p>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            University Campus
          </p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon ? iconMap[item.icon] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "grad-primary text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.65)]"
                  : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
              }`}
            >
              {Icon && (
                <Icon
                  size={17}
                  className={
                    active
                      ? "text-white"
                      : "text-slate-400 group-hover:text-indigo-500 dark:text-slate-500 dark:group-hover:text-indigo-400"
                  }
                />
              )}
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="absolute inset-y-0 right-0 w-1 rounded-l-full bg-white/40" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
