import TeacherDashboardManager from "@/components/teacherDashboard/TeacherDashboardManager";

export default async function TeacherOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <TeacherDashboardManager initialTab={tab} />;
}
