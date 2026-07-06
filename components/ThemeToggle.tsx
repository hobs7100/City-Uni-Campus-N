"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-16" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className={`focus-ring relative flex h-9 w-16 items-center rounded-full border px-1 transition-colors duration-300 ${
        isDark ? "border-indigo-400/30 bg-slate-800" : "border-amber-200 bg-amber-50"
      }`}
    >
      <span
        className={`icon-tile flex h-7 w-7 transform items-center justify-center rounded-full transition-transform duration-300 ${
          isDark ? "translate-x-7 grad-primary" : "translate-x-0 grad-amber"
        }`}
      >
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
}
