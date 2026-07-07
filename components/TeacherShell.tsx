"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LogOut, User } from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function TeacherShell({
  name,
  roleLabel,
  children,
}: {
  name: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Logged out successfully.");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-30 flex h-16 items-center justify-between px-6 glass-panel"
        style={{
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "1px solid var(--surface-border)",
        }}
      >
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{roleLabel}</span>
          </div>
          <div className="icon-tile grad-primary h-9 w-9">
            <User size={17} />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-500/10 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
