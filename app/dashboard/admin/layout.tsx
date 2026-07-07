import { getSession } from "@/lib/session";
import { RoleProvider } from "@/lib/roleContext";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return <RoleProvider role={session.role ?? "admin"}>{children}</RoleProvider>;
}
