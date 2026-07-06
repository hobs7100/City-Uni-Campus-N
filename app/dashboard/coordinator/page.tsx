import { getSession } from "@/lib/session";
import { query, queryOne } from "@/lib/db";
import { Building2, GraduationCap } from "lucide-react";

export default async function CoordinatorOverviewPage() {
  const session = await getSession();
  const department = await queryOne<{ id: string; name: string }>(
    `select id, name from departments where coordinator_id = $1`,
    [session.userId]
  );

  if (!department) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome, {session.name}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You are not yet assigned as Coordinator for any department. Please contact the administrator.
        </p>
      </div>
    );
  }

  const [students, classes] = await Promise.all([
    queryOne<{ count: string }>(`select count(*)::text as count from students where department_id = $1 and deleted_at is null`, [department.id]),
    query<{ id: string }>(`select id from classes where department_id = $1`, [department.id]),
  ]);

  const cards = [
    { label: "Students", value: Number(students?.count ?? 0), icon: GraduationCap, color: "bg-emerald-500" },
    { label: "Classes", value: classes.length, icon: Building2, color: "bg-sky-500" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{department.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Coordinator overview</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.color} text-white`}>
                <c.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{c.value}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
