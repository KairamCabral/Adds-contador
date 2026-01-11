/**
 * POST /api/admin/sync/v2/create
 * 
 * Cria um novo SyncRun e retorna o runId imediatamente.
 * A UI deve chamar /start para iniciar e /step para executar.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createSyncRun } from "@/lib/sync/executor";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Apenas cria o registro, não executa

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { companyId, mode, startDate, endDate, month } = body;

    if (!companyId) {
      return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
    }

    // Se month foi fornecido, calcular startDate/endDate
    let start: Date | undefined;
    let end: Date | undefined;

    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      start = new Date(year, monthNum - 1, 1);
      end = new Date(year, monthNum, 0, 23, 59, 59, 999);
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    }

    const syncMode = mode || (start && end ? "period" : "incremental");

    const syncRun = await createSyncRun({
      companyId,
      syncMode: syncMode,
      startDate: start,
      endDate: end,
      triggeredByUserId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      runId: syncRun.id,
      status: syncRun.status,
    });
  } catch (error: any) {
    console.error("[Sync Create] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao criar sincronização",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
