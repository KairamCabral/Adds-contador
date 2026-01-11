/**
 * POST /api/admin/sync/v2/cancel
 * 
 * Cancela um SyncRun em execução.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { cancelSyncRun } from "@/lib/sync/executor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!userHasRole(session, [Role.ADMIN, Role.OPERADOR])) {
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Sync Cancel] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao cancelar sincronização",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
