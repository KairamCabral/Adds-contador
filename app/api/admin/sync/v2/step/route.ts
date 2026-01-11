/**
 * POST /api/admin/sync/v2/step
 * 
 * Executa UM PASSO do sync (um módulo por vez).
 * Retorna o status atualizado e se ainda há trabalho pendente.
 * 
 * A UI deve chamar este endpoint em loop enquanto hasMore=true.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { runSyncStep, getSyncRunStatus } from "@/lib/sync/executor";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos por módulo

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json({ error: "runId obrigatório" }, { status: 400 });
    }

    // Executar um passo
    const hasMore = await runSyncStep(runId);

    // Buscar status atualizado
    const syncRun = await getSyncRunStatus(runId);

    return NextResponse.json({
      success: true,
      runId: syncRun.id,
      status: syncRun.status,
      currentModule: syncRun.currentModule,
      progress: syncRun.progressJson,
      hasMore,
      finishedAt: syncRun.finishedAt,
    });
  } catch (error: any) {
    console.error("[Sync Step] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao executar passo da sincronização",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
