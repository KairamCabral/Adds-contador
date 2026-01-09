import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role, SyncStatus } from "@prisma/client";

/**
 * GET /api/admin/sync/status
 * Lista syncs em execução e permite limpar travados
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get("companyId");

  // Buscar syncs RUNNING há mais de 5 minutos (considerados travados)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const runningSyncs = await prisma.syncRun.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: SyncStatus.RUNNING,
      startedAt: {
        lt: fiveMinutesAgo,
      },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  const recentSyncs = await prisma.syncRun.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { startedAt: "desc" },
    take: 5,
    select: {
      id: true,
      companyId: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      stats: true,
    },
  });

  // Última sync para polling
  const lastSync = recentSyncs[0] || null;
  
  // Extrair stats se disponível
  let syncStats = null;
  if (lastSync?.stats) {
    try {
      syncStats = typeof lastSync.stats === 'string' 
        ? JSON.parse(lastSync.stats) 
        : lastSync.stats;
    } catch (e) {
      // Ignorar erro de parse
    }
  }

  return NextResponse.json({
    stuck: runningSyncs.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      startedAt: r.startedAt,
      elapsedMinutes: Math.floor((Date.now() - r.startedAt.getTime()) / 60000),
    })),
    recent: recentSyncs,
    lastSync: lastSync ? {
      id: lastSync.id,
      status: lastSync.status,
      startedAt: lastSync.startedAt,
      finishedAt: lastSync.finishedAt,
      stats: syncStats,
    } : null,
  });
}

/**
 * POST /api/admin/sync/status (forçar finalização de sync travado)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json();
  const { syncRunId, forceStatus } = body;

  if (!syncRunId) {
    return NextResponse.json({ error: "syncRunId é obrigatório" }, { status: 400 });
  }

  // Marcar sync como FAILED ou SUCCESS forçadamente
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: {
      status: forceStatus === "OK" ? SyncStatus.SUCCESS : SyncStatus.FAILED,
      finishedAt: new Date(),
      errorMessage: "Finalizado manualmente (sync travado)",
    },
  });

  return NextResponse.json({ success: true });
}

