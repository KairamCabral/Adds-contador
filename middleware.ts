import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { Role } from "@prisma/client";

const hasAnyRole = (
  session: Awaited<ReturnType<typeof auth>>,
  roles: Role[],
) => {
  if (!session?.user?.companies?.length) return false;
  return session.user.companies.some((c) => roles.includes(c.role));
};

const redirectToLogin = (url: URL) => NextResponse.redirect(new URL("/login", url));

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isApi = pathname.startsWith("/api");
  const cronAllowed =
    pathname.startsWith("/api/admin") &&
    process.env.CRON_SECRET &&
    req.headers
      .get("authorization")
      ?.toString() === `Bearer ${process.env.CRON_SECRET}`;

  if (cronAllowed) {
    return NextResponse.next();
  }

  // Require authentication on matched routes
  if (!session?.user) {
    return isApi
      ? new NextResponse("Unauthorized", { status: 401 })
      : redirectToLogin(req.nextUrl);
  }

  // Admin-only areas
  if (pathname.startsWith("/admin")) {
    if (!hasAnyRole(session, [Role.ADMIN])) {
      return isApi
        ? new NextResponse("Forbidden", { status: 403 })
        : redirectToLogin(req.nextUrl);
    }
  }

  // Sync endpoints (ADMIN or OPERADOR)
  if (pathname.startsWith("/api/admin")) {
    if (!hasAnyRole(session, [Role.ADMIN, Role.OPERADOR])) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // Relatórios e exports (todos os papéis válidos)
  if (pathname.startsWith("/relatorios") || pathname.startsWith("/api/exports")) {
    if (!hasAnyRole(session, [Role.ADMIN, Role.CONTADOR, Role.OPERADOR])) {
      return isApi
        ? new NextResponse("Forbidden", { status: 403 })
        : redirectToLogin(req.nextUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/relatorios/:path*",
    "/api/admin/:path*",
    "/api/exports/:path*",
  ],
};

