import { NextRequest, NextResponse } from "next/server";

// Middleware simplificado para Edge Runtime (NextAuth completo não funciona aqui)
// A verificação de RBAC detalhada é feita nas rotas server-side
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Allow cron secret auth for /api/admin/*
  if (pathname.startsWith("/api/admin")) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }
  }

  // Check for session cookie (basic check - detailed RBAC is in routes)
  const sessionCookie = req.cookies.get("authjs.session-token") || req.cookies.get("__Secure-authjs.session-token");
  
  if (!sessionCookie) {
    if (pathname.startsWith("/api")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/relatorios/:path*",
    "/api/admin/:path*",
    "/api/exports/:path*",
  ],
};

