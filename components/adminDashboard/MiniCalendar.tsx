"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MiniCalendar() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array.from(
      { length: firstDay },
      () => null,
    );
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const isCurrentMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth();

  return (
    <div className="card-3d card-hover p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="icon-tile grad-cyan h-9 w-9">
            <CalendarDays size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {monthLabel}
            </p>
            <p className="text-[11px] text-slate-400">Calendar</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
              )
            }
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-900/5 dark:hover:bg-white/10"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
              )
            }
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-900/5 dark:hover:bg-white/10"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span
            key={i}
            className="py-1 text-[11px] font-semibold text-slate-400"
          >
            {w}
          </span>
        ))}
        {days.map((d, i) => {
          const isToday = isCurrentMonth && d === today.getDate();
          return (
            <span
              key={i}
              className={`flex h-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                d === null
                  ? ""
                  : isToday
                    ? "grad-primary text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              {d ?? ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
