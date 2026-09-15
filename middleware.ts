import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData, UserRole } from "@/lib/session";
import {
  isPortalManagedRole,
  PORTAL_MODULES,
  PORTAL_READ_DEPENDENCIES,
  portalModuleForRoleDashboard,
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
  // Never trust client-supplied portal authorization context.
  forwardedHeaders.delete("x-portal-module-grant");
  forwardedHeaders.delete("x-portal-target-module");
  forwardedHeaders.delete("x-portal-action");
  forwardedHeaders.delete("x-portal-read-parents");

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
      const method = request.method.toUpperCase();
      const action =
        method === "GET" || method === "HEAD"
          ? "view"
          : method === "DELETE"
            ? "delete"
            : ["POST", "PUT", "PATCH"].includes(method)
              ? "edit"
              : null;
      if (action) {
        forwardedHeaders.set("x-portal-target-module", portalModule.key);
        forwardedHeaders.set("x-portal-action", action);
      }
      if (action === "view") {
        const parents = PORTAL_MODULES.filter((candidate) =>
          PORTAL_READ_DEPENDENCIES[candidate.key]?.includes(portalModule.key),
        );
        if (parents.length > 0) {
          forwardedHeaders.set(
            "x-portal-read-parents",
            parents.map((parent) => parent.key).join(","),
          );
        }
      }
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
