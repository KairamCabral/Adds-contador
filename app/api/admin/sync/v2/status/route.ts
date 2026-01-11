/**
 * GET /api/admin/sync/v2/status?runId=xxx
 * 
 * Retorna o status atual de um SyncRun com logs recentes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getSyncRunStatus } from "@/lib/sync/executor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const runId = req.nextUrl.searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ error: "runId obrigatório" }, { status: 400 });
    }

    const syncRun = await getSyncRunStatus(runId);

    return NextResponse.json({
      success: true,
      run: {
        id: syncRun.id,
        companyId: syncRun.companyId,
        mode: syncRun.syncMode,
        status: syncRun.status,
        currentModule: syncRun.currentModule,
        progress: syncRun.progressJson,
        errorMessage: syncRun.errorMessage,
        createdAt: syncRun.createdAt,
        startedAt: syncRun.startedAt,
        finishedAt: syncRun.finishedAt,
      },
      logs: syncRun.logs.map((log) => ({
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        module: log.module,
      })),
    });
  } catch (error: any) {
    console.error("[Sync Status] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao buscar status da sincronização",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
