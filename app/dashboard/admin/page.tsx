import { Sparkles } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import StatCard from "@/components/adminDashboard/StatCard";
import MiniCalendar from "@/components/adminDashboard/MiniCalendar";
import AnnouncementsPanel from "@/components/adminDashboard/AnnouncementsPanel";
import QuickActions from "@/components/adminDashboard/QuickActions";
import RecentActivityCard from "@/components/adminDashboard/RecentActivityCard";
import { DepartmentBarChart, StatusDonutChart } from "@/components/adminDashboard/AnalyticsCharts";

async function getStats() {
  const [users, departments, classes, students, teachers, activeStudents] = await Promise.all([
    queryOne<{ count: string }>(
      `select count(*)::text as count from users where deleted_at is null`,
    ),
    queryOne<{ count: string }>(`select count(*)::text as count from departments`),
    queryOne<{ count: string }>(`select count(*)::text as count from classes`),
    queryOne<{ count: string }>(
      `select count(*)::text as count from students where deleted_at is null`,
    ),
    queryOne<{ count: string }>(
      `select count(*)::text as count from teachers where deleted_at is null`,
    ),
    queryOne<{ count: string }>(
      `select count(*)::text as count from students where deleted_at is null and status = 'active'`,
    ),
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
    `select email, actor_type, logged_in_at from login_activity order by logged_in_at desc limit 8`,
  );
}

async function getDepartmentStudentCounts() {
  return query<{ name: string; students: string }>(
    `select d.name as name, count(s.id)::text as students
 from departments d
 left join students s on s.department_id = d.id and s.deleted_at is null and s.status = 'active'
 group by d.id, d.name
 order by count(s.id) desc
 limit 8`,
  );
}

async function getStudentStatusBreakdown() {
  return query<{ status: string; count: string }>(
    `select status, count(*)::text as count from students where deleted_at is null group by status`,
  );
}

export default async function AdminOverviewPage() {
  const [stats, recentLogins, deptCounts, statusBreakdown] = await Promise.all([
    getStats(),
    getRecentLogins(),
    getDepartmentStudentCounts(),
    getStudentStatusBreakdown(),
  ]);

  const cards = [
    {
      label: "System Users",
      value: stats.users,
      icon: "Users" as const,
      gradient: "grad-primary" as const,
    },
    {
      label: "Departments",
      value: stats.departments,
      icon: "Building2" as const,
      gradient: "grad-cyan" as const,
    },
    {
      label: "Classes",
      value: stats.classes,
      icon: "Landmark" as const,
      gradient: "grad-amber" as const,
    },
    {
      label: "Active Students",
      value: stats.activeStudents,
      icon: "GraduationCap" as const,
      gradient: "grad-emerald" as const,
    },
    {
      label: "Total Students",
      value: stats.students,
      icon: "GraduationCap" as const,
      gradient: "grad-emerald" as const,
    },
    {
      label: "Teachers",
      value: stats.teachers,
      icon: "UsersRound" as const,
      gradient: "grad-rose" as const,
    },
  ];

  const barData = deptCounts.map((d) => ({ name: d.name, students: Number(d.students) }));
  const donutData = statusBreakdown.map((s) => ({
    name: s.status.replace(/_/g, ""),
    value: Number(s.count),
  }));

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="icon-tile grad-primary h-11 w-11">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Here&apos;s what&apos;s happening across City College
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            gradient={c.gradient}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DepartmentBarChart data={barData} />
        </div>
        <StatusDonutChart data={donutData} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivityCard logins={recentLogins} />
        </div>
        <div className="flex flex-col gap-4">
          <QuickActions />
          <MiniCalendar />
        </div>
      </div>

      <div className="mt-6">
        <AnnouncementsPanel />
      </div>
    </div>
  );
}
