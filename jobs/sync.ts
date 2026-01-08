/**
 * Sincronização real com a API Tiny ERP V3
 * Busca dados incrementalmente e persiste nas tabelas vw_*
 */

import { prisma } from "@/lib/db";
import { SyncStatus, TinyConnection } from "@prisma/client";
import {
  listAllPedidos,
  listAllContasReceber,
  listAllContasPagar,
  getPedido,
} from "@/lib/tiny/api";
import {
  transformPedidoResumoToVenda,
  transformPedidoToVendas,
  transformContaReceberToPosicao,
  transformContaPagarToView,
  transformContaPagaToView,
  transformContaRecebidaToView,
} from "@/lib/tiny/transformers";

// ============================================
// TIPOS
// ============================================

type SyncOptions = {
  companyId?: string;
  triggeredByUserId?: string;
  isCron?: boolean;
};

type ModuleResult = {
  module: string;
  processed: number;
  errors?: string[];
};

type SyncModule =
  | "vw_vendas"
  | "vw_contas_receber_posicao"
  | "vw_contas_pagar"
  | "vw_contas_pagas"
  | "vw_contas_recebidas";

// ============================================
// CONFIGURAÇÃO
// ============================================

// Módulos P0 (prioritários)
const P0_MODULES: SyncModule[] = [
  "vw_vendas",
  "vw_contas_receber_posicao",
  "vw_contas_pagar",
];

// Módulos P1 (secundários)
const P1_MODULES: SyncModule[] = ["vw_contas_pagas", "vw_contas_recebidas"];

// Todos os módulos para sync completo
const ALL_MODULES: SyncModule[] = [...P0_MODULES, ...P1_MODULES];

// Dias de histórico para buscar na primeira sincronização
const INITIAL_SYNC_DAYS = 90;

// Dias de histórico para sync incremental
const INCREMENTAL_SYNC_DAYS = 7;

// ============================================
// HELPERS DE SYNC RUN
// ============================================

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
  errorMessage?: string
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
  stats?: ModuleResult[]
) => {
  await prisma.auditLog.create({
    data: {
      companyId,
      actorUserId: userId,
      action: "SYNC",
      metadata: { success, stats },
    },
  });
};

// ============================================
// SYNC CURSOR MANAGEMENT
// ============================================

const getSyncCursor = async (companyId: string, module: string) => {
  return prisma.syncCursor.findUnique({
    where: {
      companyId_module: { companyId, module },
    },
  });
};

const updateSyncCursor = async (
  companyId: string,
  module: string,
  lastSyncedAt: Date
) => {
  await prisma.syncCursor.upsert({
    where: {
      companyId_module: { companyId, module },
    },
    create: {
      companyId,
      module,
      lastSyncedAt,
    },
    update: {
      lastSyncedAt,
      updatedAt: new Date(),
    },
  });
};

// ============================================
// SYNC DE VENDAS (PEDIDOS)
// ============================================

const syncVendas = async (
  companyId: string,
  connection: TinyConnection
): Promise<ModuleResult> => {
  const module = "vw_vendas";
  const errors: string[] = [];
  let processed = 0;

  try {
    // Determinar período de busca
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    const dataFinal = now;
    const dataInicial = cursor?.lastSyncedAt
      ? new Date(
          cursor.lastSyncedAt.getTime() - INCREMENTAL_SYNC_DAYS * 24 * 60 * 60 * 1000
        )
      : new Date(now.getTime() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);

    console.log(
      `[Sync ${module}] Buscando pedidos de ${dataInicial.toISOString()} até ${dataFinal.toISOString()}`
    );

    // Buscar pedidos
    const pedidos = await listAllPedidos(connection, dataInicial, dataFinal);
    console.log(`[Sync ${module}] Encontrados ${pedidos.length} pedidos`);

    // Processar cada pedido
    for (const pedido of pedidos) {
      try {
        // Para cada pedido, buscar detalhes com itens
        let vendas;
        try {
          const detalhe = await getPedido(connection, pedido.id);
          if (detalhe.itens && detalhe.itens.length > 0) {
            vendas = transformPedidoToVendas(companyId, pedido, detalhe.itens);
          } else {
            vendas = [transformPedidoResumoToVenda(companyId, pedido)];
          }
        } catch {
          // Se falhar ao buscar detalhe, usar resumo
          vendas = [transformPedidoResumoToVenda(companyId, pedido)];
        }

        // Upsert cada venda
        for (const venda of vendas) {
          await prisma.vwVendas.upsert({
            where: { id: venda.id as string },
            create: venda,
            update: {
              dataHora: venda.dataHora,
              produto: venda.produto,
              categoria: venda.categoria,
              quantidade: venda.quantidade,
              valorUnitario: venda.valorUnitario,
              valorTotal: venda.valorTotal,
              formaPagamento: venda.formaPagamento,
              vendedor: venda.vendedor,
              cliente: venda.cliente,
              cnpjCliente: venda.cnpjCliente,
              caixa: venda.caixa,
              status: venda.status,
            },
          });
          processed++;
        }

        // Salvar payload raw para auditoria
        await prisma.rawPayload.create({
          data: {
            companyId,
            module,
            externalId: String(pedido.id),
            payload: pedido as unknown as object,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Pedido ${pedido.id}: ${msg}`);
      }
    }

    // Atualizar cursor
    await updateSyncCursor(companyId, module, now);

    return { module, processed, errors: errors.length ? errors : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { module, processed: 0, errors: [msg] };
  }
};

// ============================================
// SYNC DE CONTAS A RECEBER (POSIÇÃO)
// ============================================

const syncContasReceberPosicao = async (
  companyId: string,
  connection: TinyConnection
): Promise<ModuleResult> => {
  const module = "vw_contas_receber_posicao";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    const dataPosicao = new Date(now.toISOString().split("T")[0]); // Início do dia
    const dataFinal = now;
    const dataInicial = cursor?.lastSyncedAt
      ? new Date(
          cursor.lastSyncedAt.getTime() - INCREMENTAL_SYNC_DAYS * 24 * 60 * 60 * 1000
        )
      : new Date(now.getTime() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);

    console.log(
      `[Sync ${module}] Buscando contas a receber de ${dataInicial.toISOString()} até ${dataFinal.toISOString()}`
    );

    // Buscar apenas contas abertas para posição
    const contas = await listAllContasReceber(
      connection,
      dataInicial,
      dataFinal,
      "aberto"
    );
    console.log(`[Sync ${module}] Encontradas ${contas.length} contas abertas`);

    for (const conta of contas) {
      try {
        const posicao = transformContaReceberToPosicao(
          companyId,
          conta,
          dataPosicao
        );

        await prisma.vwContasReceberPosicao.upsert({
          where: { id: posicao.id as string },
          create: posicao,
          update: {
            cliente: posicao.cliente,
            cnpj: posicao.cnpj,
            categoria: posicao.categoria,
            centroCusto: posicao.centroCusto,
            dataEmissao: posicao.dataEmissao,
            dataVencimento: posicao.dataVencimento,
            valor: posicao.valor,
            dataPosicao: posicao.dataPosicao,
          },
        });
        processed++;

        // Salvar payload raw
        await prisma.rawPayload.create({
          data: {
            companyId,
            module,
            externalId: String(conta.id),
            payload: conta as unknown as object,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Conta ${conta.id}: ${msg}`);
      }
    }

    await updateSyncCursor(companyId, module, now);

    return { module, processed, errors: errors.length ? errors : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { module, processed: 0, errors: [msg] };
  }
};

// ============================================
// SYNC DE CONTAS A PAGAR
// ============================================

const syncContasPagar = async (
  companyId: string,
  connection: TinyConnection
): Promise<ModuleResult> => {
  const module = "vw_contas_pagar";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    const dataFinal = now;
    const dataInicial = cursor?.lastSyncedAt
      ? new Date(
          cursor.lastSyncedAt.getTime() - INCREMENTAL_SYNC_DAYS * 24 * 60 * 60 * 1000
        )
      : new Date(now.getTime() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);

    console.log(
      `[Sync ${module}] Buscando contas a pagar de ${dataInicial.toISOString()} até ${dataFinal.toISOString()}`
    );

    // Buscar todas as contas (abertas)
    const contas = await listAllContasPagar(
      connection,
      dataInicial,
      dataFinal,
      "aberto"
    );
    console.log(`[Sync ${module}] Encontradas ${contas.length} contas abertas`);

    for (const conta of contas) {
      try {
        const contaView = transformContaPagarToView(companyId, conta);

        await prisma.vwContasPagar.upsert({
          where: { id: contaView.id as string },
          create: contaView,
          update: {
            fornecedor: contaView.fornecedor,
            categoria: contaView.categoria,
            centroCusto: contaView.centroCusto,
            dataEmissao: contaView.dataEmissao,
            dataVencimento: contaView.dataVencimento,
            valor: contaView.valor,
            status: contaView.status,
            formaPagto: contaView.formaPagto,
          },
        });
        processed++;

        // Salvar payload raw
        await prisma.rawPayload.create({
          data: {
            companyId,
            module,
            externalId: String(conta.id),
            payload: conta as unknown as object,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Conta ${conta.id}: ${msg}`);
      }
    }

    await updateSyncCursor(companyId, module, now);

    return { module, processed, errors: errors.length ? errors : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { module, processed: 0, errors: [msg] };
  }
};

// ============================================
// SYNC DE CONTAS PAGAS (P1)
// ============================================

const syncContasPagas = async (
  companyId: string,
  connection: TinyConnection
): Promise<ModuleResult> => {
  const module = "vw_contas_pagas";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    const dataFinal = now;
    const dataInicial = cursor?.lastSyncedAt
      ? new Date(
          cursor.lastSyncedAt.getTime() - INCREMENTAL_SYNC_DAYS * 24 * 60 * 60 * 1000
        )
      : new Date(now.getTime() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);

    // Buscar contas pagas
    const contas = await listAllContasPagar(
      connection,
      dataInicial,
      dataFinal,
      "pago"
    );

    for (const conta of contas) {
      try {
        const contaView = transformContaPagaToView(companyId, conta);
        if (!contaView) continue;

        await prisma.vwContasPagas.upsert({
          where: { id: contaView.id as string },
          create: contaView,
          update: {
            fornecedor: contaView.fornecedor,
            categoria: contaView.categoria,
            centroCusto: contaView.centroCusto,
            dataEmissao: contaView.dataEmissao,
            dataVencimento: contaView.dataVencimento,
            dataPagamento: contaView.dataPagamento,
            valorTitulo: contaView.valorTitulo,
            valorPago: contaView.valorPago,
            desconto: contaView.desconto,
            juros: contaView.juros,
            multa: contaView.multa,
            contaBancaria: contaView.contaBancaria,
            formaPagamento: contaView.formaPagamento,
            usuarioBaixa: contaView.usuarioBaixa,
            status: contaView.status,
          },
        });
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Conta ${conta.id}: ${msg}`);
      }
    }

    await updateSyncCursor(companyId, module, now);

    return { module, processed, errors: errors.length ? errors : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { module, processed: 0, errors: [msg] };
  }
};

// ============================================
// SYNC DE CONTAS RECEBIDAS (P1)
// ============================================

const syncContasRecebidas = async (
  companyId: string,
  connection: TinyConnection
): Promise<ModuleResult> => {
  const module = "vw_contas_recebidas";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    const dataFinal = now;
    const dataInicial = cursor?.lastSyncedAt
      ? new Date(
          cursor.lastSyncedAt.getTime() - INCREMENTAL_SYNC_DAYS * 24 * 60 * 60 * 1000
        )
      : new Date(now.getTime() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);

    // Buscar contas recebidas
    const contas = await listAllContasReceber(
      connection,
      dataInicial,
      dataFinal,
      "pago"
    );

    for (const conta of contas) {
      try {
        const contaView = transformContaRecebidaToView(companyId, conta);
        if (!contaView) continue;

        await prisma.vwContasRecebidas.upsert({
          where: { id: contaView.id as string },
          create: contaView,
          update: {
            cliente: contaView.cliente,
            cnpjCpf: contaView.cnpjCpf,
            categoria: contaView.categoria,
            centroCusto: contaView.centroCusto,
            dataEmissao: contaView.dataEmissao,
            dataVencimento: contaView.dataVencimento,
            dataRecebimento: contaView.dataRecebimento,
            valorTitulo: contaView.valorTitulo,
            valorRecebido: contaView.valorRecebido,
            desconto: contaView.desconto,
            juros: contaView.juros,
            multa: contaView.multa,
            comissaoCartao: contaView.comissaoCartao,
            comissaoMktplaces: contaView.comissaoMktplaces,
            contaBancaria: contaView.contaBancaria,
            formaRecebimento: contaView.formaRecebimento,
            usuarioBaixa: contaView.usuarioBaixa,
            status: contaView.status,
          },
        });
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Conta ${conta.id}: ${msg}`);
      }
    }

    await updateSyncCursor(companyId, module, now);

    return { module, processed, errors: errors.length ? errors : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { module, processed: 0, errors: [msg] };
  }
};

// ============================================
// ORQUESTRADOR PRINCIPAL
// ============================================

const syncByModule = async (
  companyId: string,
  connection: TinyConnection,
  modules: SyncModule[] = ALL_MODULES
): Promise<ModuleResult[]> => {
  const results: ModuleResult[] = [];

  for (const mod of modules) {
    console.log(`[Sync] Iniciando ${mod} para company ${companyId}`);

    let result: ModuleResult;

    switch (mod) {
      case "vw_vendas":
        result = await syncVendas(companyId, connection);
        break;
      case "vw_contas_receber_posicao":
        result = await syncContasReceberPosicao(companyId, connection);
        break;
      case "vw_contas_pagar":
        result = await syncContasPagar(companyId, connection);
        break;
      case "vw_contas_pagas":
        result = await syncContasPagas(companyId, connection);
        break;
      case "vw_contas_recebidas":
        result = await syncContasRecebidas(companyId, connection);
        break;
      default:
        result = { module: mod, processed: 0, errors: ["Módulo não implementado"] };
    }

    results.push(result);
    console.log(
      `[Sync] Finalizado ${mod}: ${result.processed} registros${
        result.errors?.length ? `, ${result.errors.length} erros` : ""
      }`
    );
  }

  return results;
};

// ============================================
// FUNÇÃO PRINCIPAL EXPORTADA
// ============================================

export async function runSync(options: SyncOptions) {
  const companies = await prisma.company.findMany({
    where: options.companyId ? { id: options.companyId } : undefined,
    include: {
      connections: {
        take: 1,
      },
    },
  });

  // Filtrar empresas que têm conexão Tiny ativa
  const filtered = companies.filter((c) => c.connections.length > 0);

  if (filtered.length === 0) {
    console.log("[Sync] Nenhuma empresa com conexão Tiny encontrada");
    return { runIds: [], message: "Nenhuma empresa com conexão Tiny" };
  }

  const runIds: string[] = [];

  for (const company of filtered) {
    const connection = company.connections[0];
    const run = await createRun(company.id, options.triggeredByUserId);
    runIds.push(run.id);

    console.log(`[Sync] Iniciando sync para ${company.name} (${company.id})`);

    try {
      const stats = await syncByModule(company.id, connection);
      const hasErrors = stats.some((s) => s.errors && s.errors.length > 0);
      const totalProcessed = stats.reduce((sum, s) => sum + s.processed, 0);

      await finishRun(
        run.id,
        hasErrors ? SyncStatus.FAILED : SyncStatus.SUCCESS,
        stats,
        hasErrors
          ? stats
              .filter((s) => s.errors)
              .map((s) => `${s.module}: ${s.errors?.join(", ")}`)
              .join("; ")
          : undefined
      );

      await logAudit(
        company.id,
        options.triggeredByUserId,
        !hasErrors,
        stats
      );

      console.log(
        `[Sync] Finalizado para ${company.name}: ${totalProcessed} registros processados`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Falha desconhecida";

      console.error(`[Sync] Erro para ${company.name}: ${errorMessage}`);

      await finishRun(run.id, SyncStatus.FAILED, [], errorMessage);
      await logAudit(company.id, options.triggeredByUserId, false);
    }
  }

  return { runIds };
}
