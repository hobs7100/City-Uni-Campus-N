import { getSession } from "@/lib/session";

export default async function TeacherOverviewPage() {
  const session = await getSession();
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome, {session.name}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Your teaching dashboard will appear here as more features are enabled in upcoming phases.
      </p>
    </div>
  );
}
