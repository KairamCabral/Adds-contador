import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";

/**
 * Endpoint para verificar configuração (apenas ADMIN)
 * Útil para diagnosticar problemas de OAuth
 */
export async function GET() {
  const session = await auth();

  // Apenas ADMIN pode ver configurações
  if (!userHasRole(session, [Role.ADMIN])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const config = {
    tiny: {
      redirectUri: process.env.TINY_REDIRECT_URI || "NÃO CONFIGURADA",
      authBase: process.env.TINY_AUTH_BASE || "https://accounts.tiny.com.br",
      clientIdConfigured: !!process.env.TINY_CLIENT_ID,
      clientSecretConfigured: !!process.env.TINY_CLIENT_SECRET,
    },
    auth: {
      authSecretConfigured: !!process.env.AUTH_SECRET,
    },
    cron: {
      cronSecretConfigured: !!process.env.CRON_SECRET,
    },
    database: {
      databaseUrlConfigured: !!process.env.DATABASE_URL,
    },
  };

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
