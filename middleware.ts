import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData, UserRole } from "@/lib/session";
import {
  isPortalManagedRole,
  PORTAL_MODULES,
  PORTAL_READ_DEPENDENCIES,
  portalModuleForRoleDashboard,
  type PortalModule,
} from "@/lib/portalPermissionsConfig";

const roleHomePage: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  hod: "/dashboard/hod",
  coordinator: "/dashboard/coordinator",
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
  finance_manager: "/dashboard/admin",
  assistant: "/dashboard/admin",
};

const rolePrefixAccess: Record<UserRole, string[]> = {
  admin: ["/dashboard/admin"],
  hod: ["/dashboard/hod", "/dashboard/admin"],
  coordinator: ["/dashboard/coordinator", "/dashboard/admin"],
  teacher: ["/dashboard/teacher"],
  student: ["/dashboard/student"],
  finance_manager: ["/dashboard/admin"],
  assistant: ["/dashboard/admin"],
};

function portalModuleForApiPath(pathname: string) {
  return [...PORTAL_MODULES]
    .sort((a, b) => b.apiPath.length - a.apiPath.length)
    .find(
      (module) =>
        pathname === module.apiPath || pathname.startsWith(`${module.apiPath}/`),
    ) ?? PORTAL_MODULES.find(
      (module) =>
        "apiPaths" in module &&
        module.apiPaths.some(
          (apiPath) => pathname === apiPath || pathname.startsWith(`${apiPath}/`),
        ),
    );
}

function portalModuleForDashboardPath(pathname: string) {
  return [...PORTAL_MODULES]
    .sort((a, b) => b.dashboardPath.length - a.dashboardPath.length)
    .find(
      (portalModule) =>
        pathname === portalModule.dashboardPath ||
        pathname.startsWith(`${portalModule.dashboardPath}/`),
    );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const forwardedHeaders = new Headers(request.headers);
  // Never trust a client-supplied portal grant. Only this middleware may add it.
  forwardedHeaders.delete("x-portal-module-grant");

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });

  let session: SessionData & { isLoggedIn: boolean; role: UserRole };
  try {
    session = await getIronSession<SessionData>(request, response, sessionOptions) as SessionData & { isLoggedIn: boolean; role: UserRole };
  } catch {
    // Session decryption failed (e.g. missing/rotated SESSION_SECRET in production)
    // Treat as unauthenticated
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/login") return NextResponse.redirect(loginUrl);
    return response;
  }

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";

  if (isDashboardRoute) {
    if (!session.isLoggedIn) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const allowedPrefixes = rolePrefixAccess[session.role] ?? [];
    const hasAccess = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
    if (!hasAccess) {
      return NextResponse.redirect(new URL(roleHomePage[session.role], request.url));
    }
    if (pathname === "/dashboard/admin/portal-management" && session.role !== "admin") {
      return NextResponse.redirect(new URL(roleHomePage[session.role], request.url));
    }
    const dashboardModule =
      portalModuleForDashboardPath(pathname) ??
      (() => {
        const moduleKey = portalModuleForRoleDashboard(
          session.role,
          pathname,
          request.nextUrl.searchParams.get("tab"),
        );
        return moduleKey
          ? PORTAL_MODULES.find((candidate) => candidate.key === moduleKey)
          : undefined;
      })();
    if (dashboardModule && isPortalManagedRole(session.role)) {
      const accessResponse = await fetch(
        new URL(`/api/portal-access?module=${encodeURIComponent(dashboardModule.key)}`, request.url),
        { headers: { cookie: request.headers.get("cookie") ?? "" } },
      ).catch(() => null);
      const access = accessResponse?.ok
        ? ((await accessResponse.json().catch(() => null)) as { canView?: boolean } | null)
        : null;
      if (access?.canView !== true) {
        return NextResponse.redirect(new URL(roleHomePage[session.role], request.url));
      }
    }
  }

  // API handlers retain their own authentication and domain checks. This
  // middleware adds the centralized portal grant check for known module paths
  // only; unknown admin API routes continue through unchanged.
  if (pathname.startsWith("/api/admin/") && pathname !== "/api/admin/portal-management") {
    const portalModule = portalModuleForApiPath(pathname);
    if (portalModule && !session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }
    if (portalModule && isPortalManagedRole(session.role)) {
      async function loadAccess(moduleKey: PortalModule) {
        const accessResponse = await fetch(
          new URL(`/api/portal-access?module=${encodeURIComponent(moduleKey)}`, request.url),
          { headers: { cookie: request.headers.get("cookie") ?? "" } },
        ).catch(() => null);
        return accessResponse?.ok
          ? ((await accessResponse.json().catch(() => null)) as
              | { canView?: boolean; canEdit?: boolean; canDelete?: boolean }
              | null)
          : null;
      }
      const access = await loadAccess(portalModule.key);
      const method = request.method.toUpperCase();
      let allowed =
        method === "GET" || method === "HEAD"
          ? access?.canView === true
          : method === "DELETE"
            ? access?.canView === true && access?.canDelete === true
            : ["POST", "PUT", "PATCH"].includes(method)
              ? access?.canView === true && access?.canEdit === true
              : true;
      if (!allowed && (method === "GET" || method === "HEAD")) {
        const parents = PORTAL_MODULES.filter((candidate) =>
          PORTAL_READ_DEPENDENCIES[candidate.key]?.includes(portalModule.key),
        );
        const parentAccess = await Promise.all(parents.map((parent) => loadAccess(parent.key)));
        allowed = parentAccess.some((candidate) => candidate?.canView === true);
      }
      if (!allowed) {
        return NextResponse.json(
          { error: "Portal Management denied this module action." },
          { status: 403 },
        );
      }
      forwardedHeaders.set("x-portal-module-grant", portalModule.key);
    }
  }

  if (isLoginRoute && session.isLoggedIn) {
    return NextResponse.redirect(new URL(roleHomePage[session.role], request.url));
  }

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/admin/:path*"],
};
