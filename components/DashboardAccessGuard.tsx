"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PORTAL_MODULES,
  portalModuleForRoleDashboard,
  type PortalModule,
} from "@/lib/portalPermissionsConfig";
import type { UserRole } from "@/lib/session";

function moduleForPath(role: UserRole, pathname: string, search: string): PortalModule | null {
  const direct = PORTAL_MODULES.find((module) => {
    const path = new URL(module.adminHref, "http://portal.local").pathname;
    return pathname === path || pathname.startsWith(`${path}/`);
  });
  if (direct) return direct.key;

  return portalModuleForRoleDashboard(
    role,
    pathname,
    new URLSearchParams(search).get("tab"),
  );
}

export default function DashboardAccessGuard({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [checkedAccess, setCheckedAccess] = useState<{
    moduleKey: PortalModule;
    allowed: boolean;
  } | null>(null);
  const portalModuleKey = useMemo(
    () => moduleForPath(role, pathname, searchParams.toString()),
    [role, pathname, searchParams],
  );
  const exactAdminOnly = pathname === "/dashboard/admin/portal-management";
  const needsLookup = !exactAdminOnly && portalModuleKey !== null && role !== "admin";
  const allowed = exactAdminOnly
    ? role === "admin"
    : !needsLookup
      ? true
      : checkedAccess?.moduleKey === portalModuleKey
        ? checkedAccess.allowed
        : null;

  useEffect(() => {
    let cancelled = false;
    if (!needsLookup || !portalModuleKey) return;
    fetch(`/api/portal-access?module=${encodeURIComponent(portalModuleKey)}`)
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!cancelled) {
          setCheckedAccess({
            moduleKey: portalModuleKey,
            allowed: ok && body.canView === true,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckedAccess({ moduleKey: portalModuleKey, allowed: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needsLookup, portalModuleKey]);

  if (allowed === false) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <h1 className="text-lg font-bold text-red-700 dark:text-red-300">Access denied</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-200">
          This dashboard area is restricted to administrators.
        </p>
      </div>
    );
  }
  if (allowed === null) {
    return <div className="p-8 text-sm text-slate-500">Checking access…</div>;
  }
  return <>{children}</>;
}