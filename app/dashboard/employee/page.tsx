import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import EmployeeTicketsDashboard from "@/components/tickets/EmployeeTicketsDashboard";

const EMPLOYEE_ROLES = ["assistant", "controller", "suprident", "accountant"] as const;

export default async function EmployeeDashboardPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  if (!EMPLOYEE_ROLES.includes(session.role as (typeof EMPLOYEE_ROLES)[number])) {
    redirect("/dashboard");
  }

  return <EmployeeTicketsDashboard />;
}