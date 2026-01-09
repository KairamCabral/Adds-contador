import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

/**
 * Status endpoint - retorna se empresa está conectada ao Tiny (sem chamar API externa)
 * GET /api/admin/tiny/status?companyId=<UUID>
 * 
 * Usado pela UI para mostrar status de conexão sem latência
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN, Role.CONTADOR, Role.OPERADOR])) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId é obrigatório" },
      { status: 400 },
    );
  }

  const connection = await prisma.tinyConnection.findFirst({
    where: { companyId },
    select: {
      id: true,
      connectedAt: true,
      expiresAt: true,
    },
  });

  if (!connection) {
    return NextResponse.json({
      connected: false,
      companyId,
    });
  }

  // Verificar se token está próximo de expirar (< 1 dia)
  const now = new Date();
  const expiresAt = connection.expiresAt;
  const isExpiringSoon = expiresAt && expiresAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000;

  return NextResponse.json({
    connected: true,
    companyId,
    connectionId: connection.id,
    connectedAt: connection.connectedAt,
    expiresAt: expiresAt,
    isExpiringSoon,
  });
}

