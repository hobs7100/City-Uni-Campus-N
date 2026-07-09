import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { navByRole, roleLabels } from "@/lib/nav";
import DashboardShell from "@/components/DashboardShell";
import TeacherShell from "@/components/TeacherShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }

  if (session.role === "teacher" || session.role === "hod" || session.role === "student") {
    return (
      <TeacherShell name={session.name} roleLabel={roleLabels[session.role]}>
        {children}
      </TeacherShell>
    );
  }

  return (
    <DashboardShell
      items={navByRole[session.role]}
      name={session.name}
      roleLabel={roleLabels[session.role]}
    >
      {children}
    </DashboardShell>
  );
}
