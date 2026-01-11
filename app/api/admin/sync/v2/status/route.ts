import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!userHasRole(session, [Role.ADMIN, Role.OPERADOR])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { error: "runId é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar SyncRun
    const syncRun = await prisma.syncRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        companyId: true,
        syncMode: true,
        startDate: true,
        endDate: true,
        status: true,
        modules: true,
        moduleIndex: true,
        cursor: true,
        progressJson: true,
        errorMessage: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    if (!syncRun) {
      return NextResponse.json(
        { error: "SyncRun não encontrado" },
        { status: 404 }
      );
    }

    // Calcular progresso
    const totalModules = syncRun.modules.length;
    const completedModules = syncRun.moduleIndex;
    const currentModule = syncRun.moduleIndex < totalModules 
      ? syncRun.modules[syncRun.moduleIndex] 
      : null;
    const progress = totalModules > 0 
      ? Math.floor((completedModules / totalModules) * 100) 
      : 0;

    return NextResponse.json({
      success: true,
      run: {
        id: syncRun.id,
        companyId: syncRun.companyId,
        mode: syncRun.syncMode,
        status: syncRun.status,
        currentModule,
        moduleIndex: syncRun.moduleIndex,
        totalModules,
        progress,
        progressJson: syncRun.progressJson,
        errorMessage: syncRun.errorMessage,
        createdAt: syncRun.createdAt,
        startedAt: syncRun.startedAt,
        finishedAt: syncRun.finishedAt,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro ao buscar status";
    console.error("[SyncV2 Status] Erro:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
