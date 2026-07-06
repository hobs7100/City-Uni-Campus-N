const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
  struck_off: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  left: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  dropped: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  freezed: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? statusStyles.inactive;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
