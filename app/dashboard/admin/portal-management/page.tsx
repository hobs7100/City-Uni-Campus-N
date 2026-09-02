import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import PortalManagementManager from "@/components/portalManagement/PortalManagementManager";

export default async function PortalManagementPage() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    redirect("/dashboard/admin");
  }

  return <PortalManagementManager />;
}