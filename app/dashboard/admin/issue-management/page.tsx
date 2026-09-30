import { redirect } from "next/navigation";
import { requireExactRole } from "@/lib/requireRole";
import AdminIssueManagement from "@/components/tickets/AdminIssueManagement";

export default async function AdminIssueManagementPage() {
  const { session } = await requireExactRole("admin");
  if (!session) redirect("/login");

  return <AdminIssueManagement />;
}