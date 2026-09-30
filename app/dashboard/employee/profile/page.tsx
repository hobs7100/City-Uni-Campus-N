import ProfilePasswordForm from "@/components/ProfilePasswordForm";
import { requireExactRole } from "@/lib/requireRole";
import { redirect } from "next/navigation";

export default async function EmployeeProfilePage() {
  const { response } = await requireExactRole("suprident", "controller", "accountant");
  if (response) redirect("/dashboard/employee");
  return <ProfilePasswordForm />;
}