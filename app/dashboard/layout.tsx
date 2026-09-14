import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDashboardNavigation, roleLabels } from "@/lib/nav";
import DashboardShell from "@/components/DashboardShell";
import TeacherShell from "@/components/TeacherShell";
import DashboardAccessGuard from "@/components/DashboardAccessGuard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }

  if (session.role === "teacher" || session.role === "student") {
    return (
      <TeacherShell name={session.name} roleLabel={roleLabels[session.role]}>
        <DashboardAccessGuard role={session.role}>{children}</DashboardAccessGuard>
      </TeacherShell>
    );
  }

  const navigation = await getDashboardNavigation(session.role);
  return (
    <DashboardShell
      items={navigation}
      name={session.name}
      roleLabel={roleLabels[session.role]}
    >
      <DashboardAccessGuard role={session.role}>{children}</DashboardAccessGuard>
    </DashboardShell>
  );
}
