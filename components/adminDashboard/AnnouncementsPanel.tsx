"use client";

import { Megaphone, Info } from "lucide-react";

const NOTES = [
  {
    text: "Close a semester once results are finalized to unlock billing for visiting faculty.",
    tone: "grad-cyan",
  },
  {
    text: "A course can only be allocated once per semester — check Allocations before starting a new one.",
    tone: "grad-amber",
  },
  {
    text: "Struck-off or blocked accounts are automatically prevented from logging in.",
    tone: "grad-rose",
  },
  {
    text: "Combined-class lectures are auto-added to every involved semester's course catalog.",
    tone: "grad-primary",
  },
];

export default function AnnouncementsPanel() {
  return (
    <div className="card-3d card-hover p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="icon-tile grad-amber h-9 w-9">
          <Megaphone size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            System Notes
          </p>
          <p className="text-[11px] text-slate-400">Good-to-know reminders</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {NOTES.map((n, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 rounded-xl bg-slate-900/[0.03] p-3 dark:bg-white/[0.04]"
          >
            <span className={`icon-tile mt-0.5 h-6 w-6 shrink-0 ${n.tone}`}>
              <Info size={12} />
            </span>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {n.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
