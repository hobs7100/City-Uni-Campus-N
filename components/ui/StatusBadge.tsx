const statusStyles: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  blocked:
    "bg-red-100 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20",
  inactive:
    "bg-slate-100 text-slate-600 ring-1 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/15",
  struck_off:
    "bg-red-100 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20",
  left: "bg-amber-100 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
  dropped:
    "bg-orange-100 text-orange-700 ring-1 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-400/20",
  freezed:
    "bg-sky-100 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/20",
  closed:
    "bg-slate-100 text-slate-500 ring-1 ring-slate-400/20 dark:bg-slate-700/30 dark:text-slate-400 dark:ring-slate-500/20",
  mid_term:
    "bg-violet-100 text-violet-700 ring-1 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20",
  final_term:
    "bg-blue-100 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20",
};

const statusLabels: Record<string, string> = {
  active:     "Active",
  blocked:    "Blocked",
  inactive:   "Inactive",
  struck_off: "Struck Off",
  left:       "Left",
  dropped:    "Dropped",
  freezed:    "Freezed",
  closed:     "Closed",
  mid_term:   "Mid Term Exam",
  final_term: "Final Term Exam",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? statusStyles.inactive;
  const label = statusLabels[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize shadow-sm ${style}`}
    >
      {label}
    </span>
  );
}
