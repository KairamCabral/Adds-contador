import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!userHasRole(session, [Role.ADMIN, Role.OPERADOR])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json(
        { error: "runId é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar SyncRun
    const syncRun = await prisma.syncRun.findUnique({
      where: { id: runId },
    });

    if (!syncRun) {
      return NextResponse.json(
        { error: "SyncRun não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se já está rodando ou finalizado
    if (syncRun.status === "RUNNING") {
      return NextResponse.json({
        success: true,
        message: "Sync já está rodando",
        status: syncRun.status,
      });
    }

    if (syncRun.status === "DONE" || syncRun.status === "FAILED" || syncRun.status === "CANCELED") {
      return NextResponse.json({
        success: false,
        message: `Sync já finalizado com status: ${syncRun.status}`,
        status: syncRun.status,
      });
    }

    // Iniciar sync
    const updated = await prisma.syncRun.update({
      where: { id: runId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    console.log(`[SyncV2 Start] ✓ SyncRun iniciado: ${runId}`);

    return NextResponse.json({
      success: true,
      runId: updated.id,
      status: updated.status,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro ao iniciar sync";
    console.error("[SyncV2 Start] Erro:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
