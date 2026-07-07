import HodDashboardManager from "@/components/hodDashboard/HodDashboardManager";

export default async function HodOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <HodDashboardManager initialTab={tab} />;
}
