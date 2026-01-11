/**
 * POST /api/admin/sync/v2/cancel
 * 
 * Cancela um SyncRun em execução.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { cancelSyncRun } from "@/lib/sync/executor";

export const dynamic = "force-dynamic";

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

    await cancelSyncRun(runId);

    return NextResponse.json({
      success: true,
      message: "Sincronização cancelada",
    });
  } catch (error: any) {
    console.error("[Sync Cancel] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao cancelar sincronização",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
