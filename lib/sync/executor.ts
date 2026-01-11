/**
 * Executor de sincronização resumable (step-by-step)
 * 
 * Permite executar sync em passos pequenos sem timeout,
 * com estado persistido no banco de dados.
 */

import { prisma } from "@/lib/db";
import { SyncStatus, Prisma } from "@prisma/client";
import {
  syncVendas,
  syncContasReceberPosicao,
  syncContasPagar,
  syncContasPagas,
  syncContasRecebidas,
  syncEstoque,
} from "@/jobs/sync-modules";
import { preEnrichPeriodProducts, shouldPreEnrich } from "./pre-enrichment";

// Módulos na ordem de execução (P0 → P3)
const SYNC_MODULES = [
  "vw_contas_receber_posicao",
  "vw_contas_pagar",
  "vw_contas_pagas",
  "vw_contas_recebidas",
  "vw_estoque",
  "vw_vendas",
] as const;

export type SyncModule = (typeof SYNC_MODULES)[number];

export interface SyncProgress {
  modules: {
    [key: string]: {
      status: "pending" | "running" | "done" | "failed";
      processed: number;
      skipped?: number;
      errors?: string[];
    };
  };
}

/**
 * Cria um novo SyncRun
 */
export async function createSyncRun(params: {
  companyId: string;
  syncMode: "incremental" | "period";
  startDate?: Date;
  endDate?: Date;
  triggeredByUserId?: string;
}) {
  const { companyId, syncMode, startDate, endDate, triggeredByUserId } = params;

  // Inicializar progressJson com todos os módulos pendentes
  const progressJson: SyncProgress = {
    modules: {},
  };

  for (const moduleName of SYNC_MODULES) {
    progressJson.modules[moduleName] = {
      status: "pending",
      processed: 0,
    };
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      companyId,
      syncMode,
      startDate,
      endDate,
      status: "QUEUED" as SyncStatus,
      progressJson: progressJson as unknown as Prisma.InputJsonValue,
      triggeredByUserId,
    },
  });

  await addLog(syncRun.id, "info", `Sync criado: mode=${syncMode}`, null);

  return syncRun;
}

/**
 * Inicia a execução de um SyncRun
 */
export async function startSyncRun(runId: string) {
  const run = await prisma.syncRun.findUnique({
    where: { id: runId },
    include: {
      company: {
        include: {
          connections: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error(`SyncRun ${runId} não encontrado`);
  }

  if (run.status !== "QUEUED") {
    throw new Error(`SyncRun ${runId} já foi iniciado (status: ${run.status})`);
  }

  // Pre-enrichment opcional para sync de período
  if (run.syncMode === "period" && run.startDate && run.endDate) {
    const connection = run.company.connections[0];
    
    if (connection) {
      await addLog(
        runId,
        "info",
        "Verificando necessidade de pre-enrichment...",
        null
      );

      try {
        // Verificar se vale a pena fazer pre-enrichment
        const shouldEnrich = await shouldPreEnrich(
          run.companyId,
          run.startDate,
          run.endDate
        );

        if (shouldEnrich) {
          await addLog(runId, "info", "Iniciando pre-enrichment...", null);

          const result = await preEnrichPeriodProducts(
            run.companyId,
            connection,
            run.startDate,
            run.endDate
          );

          await addLog(
            runId,
            "info",
            `Pre-enrichment: ${result.enriched} produtos enriquecidos em ${result.timeMs}ms`,
            null,
            result
          );
        } else {
          await addLog(
            runId,
            "info",
            "Pre-enrichment dispensado (muitos produtos ou período longo)",
            null
          );
        }
      } catch (err: unknown) {
        // Não bloquear sync se pre-enrichment falhar
        await addLog(
          runId,
          "warn",
          `Erro no pre-enrichment: ${err.message}`,
          null
        );
      }
    }
  }

  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: "RUNNING" as SyncStatus,
      startedAt: new Date(),
    },
  });

  await addLog(runId, "info", "Sync iniciado", null);

  return prisma.syncRun.findUnique({ where: { id: runId } });
}

/**
 * Executa UM PASSO do sync (um módulo por vez)
 * Retorna true se ainda há trabalho a fazer, false se concluído
 */
export async function runSyncStep(runId: string): Promise<boolean> {
  const run = await prisma.syncRun.findUnique({
    where: { id: runId },
    include: { company: { include: { connections: true } } },
  });

  if (!run) {
    throw new Error(`SyncRun ${runId} não encontrado`);
  }

  // Se foi cancelado, parar
  if (run.status === "CANCELED") {
    await addLog(runId, "info", "Sync cancelado pelo usuário", null);
    return false;
  }

  // Se não está rodando, não fazer nada
  if (run.status !== "RUNNING") {
    return false;
  }

  const progress = (run.progressJson as SyncProgress) || { modules: {} };

  // Encontrar próximo módulo pendente
  const nextModule = SYNC_MODULES.find(
    (mod) => progress.modules[mod]?.status === "pending"
  );

  if (!nextModule) {
    // Todos os módulos concluídos
    await finalizeSyncRun(runId, "DONE");
    return false;
  }

  // Atualizar status do módulo para "running"
  progress.modules[nextModule].status = "running";
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      currentModule: nextModule,
      progressJson: progress,
    },
  });

  await addLog(runId, "info", `Iniciando módulo ${nextModule}`, nextModule);

  // Executar o módulo
  try {
    const connection = run.company.connections[0];
    if (!connection) {
      throw new Error("Empresa sem conexão Tiny configurada");
    }

    const options = {
      startDate: run.startDate || undefined,
      endDate: run.endDate || undefined,
      isCron: false,
      mode: run.syncMode as "incremental" | "period",
    };

    let result;
    switch (nextModule) {
      case "vw_vendas":
        result = await syncVendas(run.companyId, connection, options);
        break;
      case "vw_contas_receber_posicao":
        result = await syncContasReceberPosicao(run.companyId, connection, options);
        break;
      case "vw_contas_pagar":
        result = await syncContasPagar(run.companyId, connection, options);
        break;
      case "vw_contas_pagas":
        result = await syncContasPagas(run.companyId, connection, options);
        break;
      case "vw_contas_recebidas":
        result = await syncContasRecebidas(run.companyId, connection, options);
        break;
      case "vw_estoque":
        result = await syncEstoque(run.companyId, connection, options);
        break;
      default:
        throw new Error(`Módulo ${nextModule} não implementado`);
    }

    // Atualizar progresso com resultado
    progress.modules[nextModule] = {
      status: "done",
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
    };

    await prisma.syncRun.update({
      where: { id: runId },
      data: { progressJson: progress },
    });

    await addLog(
      runId,
      result.errors && result.errors.length > 0 ? "warn" : "info",
      `Módulo ${nextModule} concluído: ${result.processed} processados`,
      nextModule,
      { result }
    );

    // Ainda há módulos pendentes
    return SYNC_MODULES.some((mod) => progress.modules[mod]?.status === "pending");
  } catch (error: unknown) {
    // Marcar módulo como falho mas continuar
    progress.modules[nextModule] = {
      status: "failed",
      processed: 0,
      errors: [error.message],
    };

    await prisma.syncRun.update({
      where: { id: runId },
      data: { progressJson: progress },
    });

    await addLog(runId, "error", `Erro no módulo ${nextModule}: ${error.message}`, nextModule);

    // Continuar com próximos módulos
    return SYNC_MODULES.some((mod) => progress.modules[mod]?.status === "pending");
  }
}

/**
 * Cancela um SyncRun
 */
export async function cancelSyncRun(runId: string) {
  const run = await prisma.syncRun.findUnique({ where: { id: runId } });

  if (!run) {
    throw new Error(`SyncRun ${runId} não encontrado`);
  }

  if (run.status === "DONE" || run.status === "FAILED") {
    throw new Error(`SyncRun ${runId} já foi finalizado (status: ${run.status})`);
  }

  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: "CANCELED" as SyncStatus,
      finishedAt: new Date(),
    },
  });

  await addLog(runId, "info", "Sync cancelado pelo usuário", null);
}

/**
 * Finaliza um SyncRun
 */
async function finalizeSyncRun(runId: string, status: "DONE" | "FAILED") {
  const run = await prisma.syncRun.findUnique({ where: { id: runId } });

  if (!run) {
    throw new Error(`SyncRun ${runId} não encontrado`);
  }

  const progress = (run.progressJson as SyncProgress) || { modules: {} };

  // Contar módulos com erro
  const failedModules = Object.entries(progress.modules).filter(
    ([, mod]) => mod.status === "failed"
  );

  const errorMessage =
    failedModules.length > 0
      ? `${failedModules.length} módulo(s) falharam: ${failedModules.map(([name]) => name).join(", ")}`
      : undefined;

  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: status as SyncStatus,
      finishedAt: new Date(),
      currentModule: null,
      errorMessage,
    },
  });

  await addLog(
    runId,
    status === "DONE" ? "info" : "error",
    `Sync finalizado: ${status}`,
    null
  );
}

/**
 * Adiciona um log ao SyncRun
 */
async function addLog(
  runId: string,
  level: "info" | "warn" | "error",
  message: string,
  module: string | null,
  metadata?: unknown
) {
  await prisma.syncRunLog.create({
    data: {
      runId,
      level,
      message,
      module,
      metadata: metadata || undefined,
    },
  });
}

/**
 * Obtém o status de um SyncRun com logs recentes
 */
export async function getSyncRunStatus(runId: string) {
  const run = await prisma.syncRun.findUnique({
    where: { id: runId },
    include: {
      logs: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
  });

  if (!run) {
    throw new Error(`SyncRun ${runId} não encontrado`);
  }

  return run;
}
