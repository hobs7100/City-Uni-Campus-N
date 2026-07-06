import { Building2, GraduationCap, Landmark, Users, UsersRound } from "lucide-react";
import { query, queryOne } from "@/lib/db";

async function getStats() {
  const [users, departments, classes, students, teachers, activeStudents] = await Promise.all([
    queryOne<{ count: string }>(`select count(*)::text as count from users where deleted_at is null`),
    queryOne<{ count: string }>(`select count(*)::text as count from departments`),
    queryOne<{ count: string }>(`select count(*)::text as count from classes`),
    queryOne<{ count: string }>(`select count(*)::text as count from students where deleted_at is null`),
    queryOne<{ count: string }>(`select count(*)::text as count from teachers where deleted_at is null`),
    queryOne<{ count: string }>(`select count(*)::text as count from students where deleted_at is null and status = 'active'`),
  ]);
  return {
    users: Number(users?.count ?? 0),
    departments: Number(departments?.count ?? 0),
    classes: Number(classes?.count ?? 0),
    students: Number(students?.count ?? 0),
    teachers: Number(teachers?.count ?? 0),
    activeStudents: Number(activeStudents?.count ?? 0),
  };
}

async function getRecentLogins() {
  return query<{ email: string; actor_type: string; logged_in_at: string }>(
    `select email, actor_type, logged_in_at from login_activity order by logged_in_at desc limit 8`
  );
}

export default async function AdminOverviewPage() {
  const [stats, recentLogins] = await Promise.all([getStats(), getRecentLogins()]);

  const cards = [
    { label: "System Users", value: stats.users, icon: Users, color: "bg-indigo-500" },
    { label: "Departments", value: stats.departments, icon: Building2, color: "bg-sky-500" },
    { label: "Classes", value: stats.classes, icon: Landmark, color: "bg-amber-500" },
    { label: "Students (Active)", value: stats.activeStudents, icon: GraduationCap, color: "bg-emerald-500" },
    { label: "Total Students", value: stats.students, icon: GraduationCap, color: "bg-emerald-600" },
    { label: "Teachers", value: stats.teachers, icon: UsersRound, color: "bg-rose-500" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Here&apos;s what&apos;s happening across City College</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recent Login Activity</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Logged In At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLogins.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">No login activity yet.</td></tr>
            ) : (
              recentLogins.map((l, idx) => (
                <tr key={idx}>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{l.email}</td>
                  <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">{l.actor_type}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(l.logged_in_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
