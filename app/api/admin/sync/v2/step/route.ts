import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  processVendasChunk,
  processContasReceberChunk,
  processContasPagarChunk,
  processContasPagasChunk,
  processContasRecebidasChunk,
} from "@/lib/sync/chunk-executor";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
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

    // Buscar SyncRun com conexão Tiny
    const syncRun = await prisma.syncRun.findUnique({
      where: { id: runId },
      include: {
        company: {
          include: {
            connections: {
              take: 1,
            },
          },
        },
      },
    });

    if (!syncRun) {
      return NextResponse.json(
        { error: "SyncRun não encontrado" },
        { status: 404 }
      );
    }

    // Se não está RUNNING, retornar status atual
    if (syncRun.status !== "RUNNING") {
      return NextResponse.json({
        success: true,
        status: syncRun.status,
        message: `Sync não está rodando (status: ${syncRun.status})`,
      });
    }

    // Verificar conexão Tiny
    const connection = syncRun.company.connections[0];
    if (!connection) {
      await prisma.syncRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          errorMessage: "Sem conexão Tiny",
          finishedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: false,
        error: "Sem conexão Tiny",
        status: "ERROR",
      });
    }

    // Verificar se já finalizou todos os módulos
    if (syncRun.moduleIndex >= syncRun.modules.length) {
      await prisma.syncRun.update({
        where: { id: runId },
        data: {
          status: "DONE",
          finishedAt: new Date(),
        },
      });

      const durationMs = Date.now() - startTime;
      const totalDurationMs = syncRun.startedAt 
        ? Date.now() - syncRun.startedAt.getTime()
        : durationMs;

      console.log(
        `[SyncV2 Step] RUN END status=success runId=${runId} totalDurationMs=${totalDurationMs}`
      );

      return NextResponse.json({
        success: true,
        status: "DONE",
        message: "Todos os módulos foram processados",
      });
    }

    // Pegar módulo atual
    const currentModule = syncRun.modules[syncRun.moduleIndex];
    const cursor = (syncRun.cursor as Record<string, unknown>) || {};

    console.log(`[SyncV2 Step] STEP START module=${currentModule} (${syncRun.moduleIndex + 1}/${syncRun.modules.length}) runId=${runId}`);

    // Processar chunk baseado no módulo
    let result;
    const startDate = syncRun.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = syncRun.endDate || new Date();

    switch (currentModule) {
      case "vw_vendas":
        result = await processVendasChunk(
          syncRun.companyId,
          connection,
          startDate,
          endDate,
          cursor
        );
        break;

      case "vw_contas_receber_posicao":
        result = await processContasReceberChunk(
          syncRun.companyId,
          connection,
          startDate,
          endDate,
          cursor
        );
        break;

      case "vw_contas_pagar":
        result = await processContasPagarChunk(
          syncRun.companyId,
          connection,
          startDate,
          endDate,
          cursor
        );
        break;

      case "vw_contas_pagas":
        result = await processContasPagasChunk();
        break;

      case "vw_contas_recebidas":
        result = await processContasRecebidasChunk();
        break;

      default:
        result = {
          processed: 0,
          cursor: {},
          done: true,
          error: `Módulo não implementado: ${currentModule}`,
        };
    }

    // Atualizar progresso
    const progressJson = (syncRun.progressJson as Record<string, unknown>) || {};
    
    // Type guard para acessar propriedades
    const moduleProgress = progressJson[currentModule];
    const currentProcessed = 
      moduleProgress && 
      typeof moduleProgress === 'object' && 
      'processed' in moduleProgress &&
      typeof moduleProgress.processed === 'number'
        ? moduleProgress.processed
        : 0;
    
    progressJson[currentModule] = { 
      processed: currentProcessed + result.processed 
    };

    // Se o módulo terminou, avançar para o próximo
    const newModuleIndex = result.done ? syncRun.moduleIndex + 1 : syncRun.moduleIndex;
    const newCursor = result.done ? {} : result.cursor;

    // Se tinha erro, marcar como ERROR
    if (result.error) {
      await prisma.syncRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          errorMessage: result.error,
          progressJson: progressJson as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });

      const totalDurationMs = syncRun.startedAt 
        ? Date.now() - syncRun.startedAt.getTime()
        : Date.now() - startTime;

      console.error(
        `[SyncV2 Step] RUN END status=error runId=${runId} module=${currentModule} error="${result.error}" totalDurationMs=${totalDurationMs}`
      );

      return NextResponse.json({
        success: false,
        status: "ERROR",
        error: result.error,
      });
    }

    // Atualizar SyncRun
    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        moduleIndex: newModuleIndex,
        cursor: newCursor as unknown as Prisma.InputJsonValue,
        progressJson: progressJson as unknown as Prisma.InputJsonValue,
        currentModule: newModuleIndex < syncRun.modules.length 
          ? syncRun.modules[newModuleIndex] 
          : null,
      },
    });

    const durationMs = Date.now() - startTime;
    const totalProgress = Math.floor((newModuleIndex / syncRun.modules.length) * 100);

    console.log(
      `[SyncV2 Step] STEP END module=${currentModule} processed=${result.processed} done=${result.done} tookMs=${durationMs} progress=${totalProgress}%`
    );

    return NextResponse.json({
      success: true,
      status: "RUNNING",
      currentModule,
      processed: result.processed,
      done: result.done,
      moduleProgress: newModuleIndex,
      totalModules: syncRun.modules.length,
      overallProgress: totalProgress,
      durationMs,
      hasMore: newModuleIndex < syncRun.modules.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro ao executar step";
    console.error("[SyncV2 Step] Erro:", error);

    // Tentar marcar como ERROR no banco
    try {
      const body = await request.json();
      const { runId } = body;
      if (runId) {
        await prisma.syncRun.update({
          where: { id: runId },
          data: {
            status: "FAILED",
            errorMessage,
            finishedAt: new Date(),
          },
        });
      }
    } catch (updateErr) {
      console.error("[SyncV2 Step] Erro ao atualizar status:", updateErr);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
