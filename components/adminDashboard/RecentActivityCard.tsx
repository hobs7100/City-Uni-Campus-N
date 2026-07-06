"use client";

import { History } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export default function RecentActivityCard({
  logins,
}: {
  logins: { email: string; actor_type: string; logged_in_at: string }[];
}) {
  return (
    <div className="card-3d overflow-hidden">
      <div
        className="flex items-center gap-2 border-b px-5 py-4"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div className="icon-tile grad-cyan h-9 w-9">
          <History size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Recent Login Activity
          </p>
          <p className="text-[11px] text-slate-400">
            Latest sign-ins across all roles
          </p>
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Email</th>
            <th className="px-5 py-3 font-semibold">Role</th>
            <th className="px-5 py-3 font-semibold">Logged In At</th>
          </tr>
        </thead>
        <tbody
          className="divide-y"
          style={{ borderColor: "var(--surface-border)" }}
        >
          {logins.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-5 py-10 text-center text-slate-400">
                No login activity yet.
              </td>
            </tr>
          ) : (
            logins.map((l, idx) => (
              <tr
                key={idx}
                className="transition hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.03]"
              >
                <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                  {l.email}
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-600 dark:text-indigo-400">
                    {l.actor_type}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {formatDateTime(l.logged_in_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
