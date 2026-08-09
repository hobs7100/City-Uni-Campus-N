import { getSession } from "@/lib/session";
import StudentManagementPage from "@/components/students/StudentManagementPage";

export default async function AdminStudentsPage() {
  const session = await getSession();
  const role = session.role === "assistant" ? "assistant" : "admin";
  return <StudentManagementPage role={role} />;
}
