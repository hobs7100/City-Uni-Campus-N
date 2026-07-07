import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PageLoader } from "@/components/ui/Loaders";
import FmDashboardManager from "@/components/fmDashboard/FmDashboardManager";

export default async function FmDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "finance_manager") redirect("/login");

  const { tab } = await searchParams;

  return (
    <Suspense fallback={<PageLoader />}>
      <FmDashboardManager initialTab={tab} />
    </Suspense>
  );
}
