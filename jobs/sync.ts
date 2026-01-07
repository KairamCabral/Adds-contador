import { prisma } from "@/lib/db";
import { SyncStatus, TinyConnection } from "@/lib/generated/prisma";

type SyncOptions = {
  companyId?: string;
  triggeredByUserId?: string;
  isCron?: boolean;
};

type ModuleResult = {
  module: string;
  processed: number;
};

const modules = [
  "vw_vendas",
  "vw_contas_receber_posicao",
  "vw_contas_pagar",
  "vw_contas_pagas",
  "vw_estoque",
  "vw_contas_recebidas",
];

const createRun = (companyId: string, triggeredByUserId?: string) =>
  prisma.syncRun.create({
    data: {
      companyId,
      status: SyncStatus.RUNNING,
      triggeredByUserId,
    },
  });

const finishRun = async (
  runId: string,
  status: SyncStatus,
  stats: ModuleResult[],
  errorMessage?: string,
) => {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      errorMessage,
      stats: stats.length ? stats : undefined,
    },
  });
};

const logAudit = async (
  companyId: string,
  userId: string | undefined,
  success: boolean,
) => {
  await prisma.auditLog.create({
    data: {
      companyId,
      actorUserId: userId,
      action: "SYNC",
      metadata: { success },
    },
  });
};

const noopSync = async (
  _companyId: string,
  _connection: TinyConnection,
  module: string,
): Promise<ModuleResult> => {
  // TODO: implementar integração real com a Tiny para o módulo informado.
  // Estrutura pronta para leitura incremental e gravação nas tabelas vw_*.
  // Neste esqueleto, não processamos registros.
  return { module, processed: 0 };
};

const syncByModule = async (
  companyId: string,
  connection: TinyConnection,
): Promise<ModuleResult[]> => {
  const results: ModuleResult[] = [];

  for (const mod of modules) {
    const result = await noopSync(companyId, connection, mod);
    results.push(result);
  }

  return results;
};

export async function runSync(options: SyncOptions) {
  const companies = await prisma.company.findMany({
    where: options.companyId ? { id: options.companyId } : undefined,
    include: {
      connections: {
        take: 1,
      },
    },
  });

  const filtered = companies.filter((c) => c.connections.length > 0);
  const runIds: string[] = [];

  for (const company of filtered) {
    const connection = company.connections[0];
    const run = await createRun(company.id, options.triggeredByUserId);
    runIds.push(run.id);

    try {
      const stats = await syncByModule(company.id, connection);
      await finishRun(run.id, SyncStatus.SUCCESS, stats);
      await logAudit(company.id, options.triggeredByUserId, true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Falha desconhecida";
      await finishRun(run.id, SyncStatus.FAILED, [], errorMessage);
      await logAudit(company.id, options.triggeredByUserId, false);
    }
  }

  return { runIds };
}

