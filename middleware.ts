import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData, UserRole } from "@/lib/session";

const roleHomePage: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  hod: "/dashboard/hod",
  coordinator: "/dashboard/coordinator",
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
};

const rolePrefixAccess: Record<UserRole, string[]> = {
  admin: ["/dashboard/admin"],
  hod: ["/dashboard/hod"],
  coordinator: ["/dashboard/coordinator"],
  teacher: ["/dashboard/teacher"],
  student: ["/dashboard/student"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

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
  }

  if (isLoginRoute && session.isLoggedIn) {
    return NextResponse.redirect(new URL(roleHomePage[session.role], request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
