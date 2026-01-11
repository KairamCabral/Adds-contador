/**
 * POST /api/admin/sync/v2/start
 * 
 * Inicia a execução de um SyncRun (muda status de QUEUED para RUNNING).
 * Deve ser chamado UMA VEZ após criar o run.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { startSyncRun } from "@/lib/sync/executor";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

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

    const syncRun = await startSyncRun(runId);

    return NextResponse.json({
      success: true,
      runId: syncRun?.id,
      status: syncRun?.status,
    });
  } catch (error: any) {
    console.error("[Sync Start] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao iniciar sincronização",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
