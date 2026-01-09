/**
 * Sincronização real com a API Tiny ERP V3
 * Busca dados incrementalmente e persiste nas tabelas vw_*
 */

import { prisma } from "@/lib/db";
import { getSyncConfig } from "@/lib/config";
import { SyncStatus, TinyConnection } from "@prisma/client";
import {
  listAllPedidos,
  listAllContasReceber,
  listAllContasPagar,
  getPedido,
  listAllEstoque,
} from "@/lib/tiny/api";
import type { TinyPedidoDetalhe } from "@/lib/tiny/types";
import {
  transformPedidoResumoToVenda,
  transformPedidoDetalheToVendas,
  transformContaReceberToPosicao,
  transformContaPagarToView,
  transformContaPagaToView,
  transformContaRecebidaToView,
  transformProdutoToEstoque,
} from "@/lib/tiny/transformers";
import { getProduto, clearCache, getCacheStats } from "@/lib/tiny/enrichment";

// ============================================
// TIPOS
// ============================================

type SyncOptions = {
  companyId?: string;
  triggeredByUserId?: string;
  isCron?: boolean;
  startDate?: Date;
  endDate?: Date;
  modules?: SyncModule[];
};

type ModuleResult = {
  module: string;
  processed: number;
  skipped?: number;
  errors?: string[];
};

type SyncModule =
  | "vw_vendas"
  | "vw_contas_receber_posicao"
  | "vw_contas_pagar"
  | "vw_contas_pagas"
  | "vw_contas_recebidas"
  | "vw_estoque";

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

// Módulos P2 (estoque - snapshot diário)
const P2_MODULES: SyncModule[] = ["vw_estoque"];

// Todos os módulos para sync completo
const ALL_MODULES: SyncModule[] = [...P0_MODULES, ...P1_MODULES, ...P2_MODULES];

// Configuração de lookback (via env vars)
const { initialLookbackDays: INITIAL_SYNC_DAYS, incrementalLookbackDays: INCREMENTAL_SYNC_DAYS } = getSyncConfig();

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
  connection: TinyConnection,
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean }
): Promise<ModuleResult> => {
  const module = "vw_vendas";
  const errors: string[] = [];
  let processed = 0;
  let skipped = 0;

  try {
    // Determinar período de busca
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    
    let dataFinal: Date;
    let dataInicial: Date;
    
    // Se datas específicas foram fornecidas, usar elas
    if (options?.startDate && options?.endDate) {
      dataInicial = options.startDate;
      dataFinal = options.endDate;
    } else {
      // Lookback reduzido para cron (30 dias) ou padrão (90 inicial / 7 incremental)
      const lookbackDays = options?.isCron ? 30 : INITIAL_SYNC_DAYS;
      const incrementalDays = options?.isCron ? 7 : INCREMENTAL_SYNC_DAYS;
      
      dataFinal = now;
      dataInicial = cursor?.lastSyncedAt
        ? new Date(cursor.lastSyncedAt.getTime() - incrementalDays * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    }

    console.log(
      `[Sync ${module}] Buscando pedidos de ${dataInicial.toISOString()} até ${dataFinal.toISOString()}`
    );

    // Buscar pedidos
    let pedidos = await listAllPedidos(connection, dataInicial, dataFinal);
    
    // Limitar pedidos em modo dev (quando datas específicas são fornecidas)
    const isDevMode = options?.startDate && options?.endDate && !options?.isCron;
    if (isDevMode && pedidos.length > 10) {
      console.log(`[Sync ${module}] MODO DEV: Limitando de ${pedidos.length} para 10 pedidos`);
      pedidos = pedidos.slice(0, 10);
    }
    
    console.log(`[Sync ${module}] Encontrados ${pedidos.length} pedidos`);

    // FASE 1: Coletar IDs únicos de produtos para enrichment
    const produtoIds = new Set<number>();
    const pedidosDetalhados: (TinyPedidoDetalhe | null)[] = [];
    
    for (const pedido of pedidos) {
      try {
        const detalhe = await getPedido(connection, pedido.id);
        pedidosDetalhados.push(detalhe);
        
        // Coletar IDs de produtos
        if (detalhe.itens && Array.isArray(detalhe.itens)) {
          for (const item of detalhe.itens) {
            const produtoId = item?.produto?.id;
            if (produtoId && typeof produtoId === 'number') {
              produtoIds.add(produtoId);
            }
          }
        }
      } catch (err) {
        console.warn(`[Sync] Falha ao buscar pedido ${pedido.id}, pulando enrichment`);
        pedidosDetalhados.push(null); // Placeholder para manter índice
      }
    }

    console.log(`[Sync ${module}] Enriquecendo ${produtoIds.size} produtos únicos...`);

    // FASE 2: Buscar informações de produtos (categorias) em paralelo
    const produtosEnriquecidos = new Map<number, any>();
    const produtoIdsArray = Array.from(produtoIds);
    
    // Buscar produtos com concorrência limitada (3 por vez, mais conservador)
    for (let i = 0; i < produtoIdsArray.length; i += 3) {
      const batch = produtoIdsArray.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(id => getProduto(connection, id))
      );
      
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          produtosEnriquecidos.set(batch[idx], result.value);
        } else if (result.status === 'rejected') {
          console.warn(`[Sync] Produto ${batch[idx]} falhou no enrichment:`, result.reason?.message || 'Unknown error');
        }
      });
      
      // Delay maior entre batches para evitar rate limit 429 (600ms)
      if (i + 3 < produtoIdsArray.length) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    console.log(`[Sync ${module}] ${produtosEnriquecidos.size}/${produtoIds.size} produtos enriquecidos`);// FASE 3: Processar cada pedido com enrichment
    for (let i = 0; i < pedidosDetalhados.length; i++) {
      const detalhe = pedidosDetalhados[i];
      const pedido = pedidos[i];
      
      try {
        // Para cada pedido, transformar com enrichment
        let vendas;
        try {
          if (detalhe) {
            // Usar o pedido DETALHE completo (com cliente, pagamento, itens) + enrichment
            vendas = transformPedidoDetalheToVendas(companyId, detalhe, {
              produtos: produtosEnriquecidos,
            });
          } else {
            // Fallback para pedido resumo
            vendas = [transformPedidoResumoToVenda(companyId, pedido)];
          }
        } catch (detailErr) {
          const msg = detailErr instanceof Error ? detailErr.message : String(detailErr);
          console.warn(`[Sync] Falha ao transformar pedido ${pedido.id}: ${msg.substring(0, 200)}`);
          vendas = [transformPedidoResumoToVenda(companyId, pedido)];
        }

        // Upsert cada venda (com per-row error handling)
        for (const venda of vendas) {
          try {
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
          } catch (upsertErr) {
            const msg = upsertErr instanceof Error ? upsertErr.message : String(upsertErr);
            console.warn(`[Sync] Pulando venda ${venda.id}: ${msg.substring(0, 100)}`);
            errors.push(`Venda ${venda.id}: ${msg.split("\n")[0]}`); // Só primeira linha
            skipped++;
          }
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Pedido ${pedido.id}: ${msg}`);
      }
    }

    // Salvar payloads raw em batch (fora do loop principal)
    if (pedidos.length > 0) {
      try {
        await prisma.rawPayload.createMany({
          data: pedidos.map((pedido) => ({
            companyId,
            module,
            externalId: String(pedido.id),
            payload: pedido as unknown as object,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        console.warn(`[Sync ${module}] Erro ao salvar payloads raw:`, err);
      }
    }

    // Estatísticas do cache de enrichment
    const cacheStats = getCacheStats(connection.id);
    console.log(`[Sync ${module}] Cache: ${cacheStats.produtos} produtos, ${cacheStats.pessoas} pessoas, ${cacheStats.categorias} categorias`);

    // Limpar cache após sync
    clearCache(connection.id);

    // Atualizar cursor
    await updateSyncCursor(companyId, module, now);

    return { 
      module, 
      processed, 
      skipped,
      errors: errors.length ? errors : undefined 
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Limpar cache mesmo em erro
    clearCache(connection.id);
    return { module, processed: 0, skipped: 0, errors: [msg] };
  }
};

// ============================================
// SYNC DE CONTAS A RECEBER (POSIÇÃO)
// ============================================

const syncContasReceberPosicao = async (
  companyId: string,
  connection: TinyConnection,
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean }
): Promise<ModuleResult> => {
  const module = "vw_contas_receber_posicao";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    const dataPosicao = new Date(now.toISOString().split("T")[0]); // Início do dia
    
    let dataFinal: Date;
    let dataInicial: Date;
    
    if (options?.startDate && options?.endDate) {
      dataInicial = options.startDate;
      dataFinal = options.endDate;
    } else {
      const lookbackDays = options?.isCron ? 30 : INITIAL_SYNC_DAYS;
      const incrementalDays = options?.isCron ? 7 : INCREMENTAL_SYNC_DAYS;
      
      dataFinal = now;
      dataInicial = cursor?.lastSyncedAt
        ? new Date(cursor.lastSyncedAt.getTime() - incrementalDays * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    }

    console.log(
      `[Sync ${module}] Buscando contas a receber de ${dataInicial.toISOString()} até ${dataFinal.toISOString()}`
    );// Buscar apenas contas abertas para posição
    let contas = await listAllContasReceber(
      connection,
      dataInicial,
      dataFinal,
      "aberto"
    );
    
    // Limitar em modo dev
    const isDevMode = options?.startDate && options?.endDate && !options?.isCron;
    if (isDevMode && contas.length > 10) {
      console.log(`[Sync ${module}] MODO DEV: Limitando de ${contas.length} para 10 contas`);
      contas = contas.slice(0, 10);
    }
    
    console.log(`[Sync ${module}] Encontradas ${contas.length} contas abertas`);

    // Enriquecer contas com detalhe (para pegar categoria)
    console.log(`[Sync ${module}] Buscando detalhes para enriquecer categorias...`);
    const contasEnriquecidas = [];
    for (let i = 0; i < contas.length; i++) {
      const conta = contas[i];
      try {
        // Buscar detalhe que inclui categoria
        const { getContaReceberDetalhe } = await import("@/lib/tiny/api");
        const detalhe = await getContaReceberDetalhe(connection, conta.id as number);
        contasEnriquecidas.push(detalhe);
        
        // Log progresso a cada 10
        if ((i + 1) % 10 === 0 || i === contas.length - 1) {
          console.log(`[Sync ${module}] Enriquecidas ${i + 1}/${contas.length} contas`);
        }
        
        // Pequeno delay para evitar rate limit
        if (i < contas.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.warn(`[Sync ${module}] Erro ao buscar detalhe da conta ${conta.id}:`, error);
        // Se falhar, usa a conta original (sem categoria)
        contasEnriquecidas.push(conta);
      }
    }

    for (const conta of contasEnriquecidas) {
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const contaObj = conta as Record<string, unknown>;
        const contaId = contaObj?.id || 'desconhecido';
        errors.push(`Conta ${contaId}: ${msg}`);
      }
    }

    // Salvar payloads raw em batch (fora do loop principal)
    if (contas.length > 0) {
      try {
        await prisma.rawPayload.createMany({
          data: contas.map((conta) => ({
            companyId,
            module,
            externalId: String(conta.id),
            payload: conta as unknown as object,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        console.warn(`[Sync ${module}] Erro ao salvar payloads raw:`, err);
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
  connection: TinyConnection,
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean }
): Promise<ModuleResult> => {
  const module = "vw_contas_pagar";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    
    let dataFinal: Date;
    let dataInicial: Date;
    
    if (options?.startDate && options?.endDate) {
      dataInicial = options.startDate;
      dataFinal = options.endDate;
    } else {
      const lookbackDays = options?.isCron ? 30 : INITIAL_SYNC_DAYS;
      const incrementalDays = options?.isCron ? 7 : INCREMENTAL_SYNC_DAYS;
      
      dataFinal = now;
      dataInicial = cursor?.lastSyncedAt
        ? new Date(cursor.lastSyncedAt.getTime() - incrementalDays * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    }

    console.log(
      `[Sync ${module}] Buscando contas a pagar de ${dataInicial.toISOString()} até ${dataFinal.toISOString()}`
    );

    // Buscar todas as contas (abertas)
    let contas = await listAllContasPagar(
      connection,
      dataInicial,
      dataFinal,
      "aberto"
    );
    
    // Limitar em modo dev
    const isDevMode = options?.startDate && options?.endDate && !options?.isCron;
    if (isDevMode && contas.length > 10) {
      console.log(`[Sync ${module}] MODO DEV: Limitando de ${contas.length} para 10 contas`);
      contas = contas.slice(0, 10);
    }
    
    console.log(`[Sync ${module}] Encontradas ${contas.length} contas abertas`);

    for (const conta of contas) {
      try {const contaView = transformContaPagarToView(companyId, conta);await prisma.vwContasPagar.upsert({
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
        });processed++;
      } catch (err) {const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Conta ${conta.id}: ${msg}`);
      }
    }

    // Salvar payloads raw em batch (fora do loop principal)
    if (contas.length > 0) {
      try {
        await prisma.rawPayload.createMany({
          data: contas.map((conta) => ({
            companyId,
            module,
            externalId: String(conta.id),
            payload: conta as unknown as object,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        console.warn(`[Sync ${module}] Erro ao salvar payloads raw:`, err);
      }
    }

    await updateSyncCursor(companyId, module, now);return { module, processed, errors: errors.length ? errors : undefined };
  } catch (err) {const msg = err instanceof Error ? err.message : String(err);
    return { module, processed: 0, errors: [msg] };
  }
};

// ============================================
// SYNC DE CONTAS PAGAS (P1)
// ============================================

const syncContasPagas = async (
  companyId: string,
  connection: TinyConnection,
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean }
): Promise<ModuleResult> => {
  const module = "vw_contas_pagas";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    
    let dataFinal: Date;
    let dataInicial: Date;
    
    if (options?.startDate && options?.endDate) {
      dataInicial = options.startDate;
      dataFinal = options.endDate;
    } else {
      const lookbackDays = options?.isCron ? 30 : INITIAL_SYNC_DAYS;
      const incrementalDays = options?.isCron ? 7 : INCREMENTAL_SYNC_DAYS;
      
      dataFinal = now;
      dataInicial = cursor?.lastSyncedAt
        ? new Date(cursor.lastSyncedAt.getTime() - incrementalDays * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    }

    // Buscar contas pagas
    let contas = await listAllContasPagar(
      connection,
      dataInicial,
      dataFinal,
      "pago"
    );
    
    // Limitar em modo dev
    const isDevMode = options?.startDate && options?.endDate && !options?.isCron;
    if (isDevMode && contas.length > 10) {
      console.log(`[Sync ${module}] MODO DEV: Limitando de ${contas.length} para 10 contas`);
      contas = contas.slice(0, 10);
    }
    
    console.log(`[Sync ${module}] Processando ${contas.length} contas pagas`);
    
    const titulosProcessados: bigint[] = [];
    
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
        
        titulosProcessados.push(contaView.tituloId);
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Conta ${conta.id}: ${msg}`);
      }
    }

    // LIMPEZA: Remover de vw_contas_pagar as contas que foram pagas
    if (titulosProcessados.length > 0) {
      try {
        const deleted = await prisma.vwContasPagar.deleteMany({
          where: {
            companyId,
            tituloId: { in: titulosProcessados },
          },
        });
        
        if (deleted.count > 0) {
          console.log(`[Sync ${module}] 🧹 Removidas ${deleted.count} contas pagas de vw_contas_pagar`);
        }
      } catch (err) {
        console.warn(`[Sync ${module}] Aviso: Erro ao limpar contas pagas de vw_contas_pagar:`, err);
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
  connection: TinyConnection,
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean }
): Promise<ModuleResult> => {
  const module = "vw_contas_recebidas";
  const errors: string[] = [];
  let processed = 0;

  try {
    const cursor = await getSyncCursor(companyId, module);
    const now = new Date();
    
    let dataFinal: Date;
    let dataInicial: Date;
    
    if (options?.startDate && options?.endDate) {
      dataInicial = options.startDate;
      dataFinal = options.endDate;
    } else {
      const lookbackDays = options?.isCron ? 30 : INITIAL_SYNC_DAYS;
      const incrementalDays = options?.isCron ? 7 : INCREMENTAL_SYNC_DAYS;
      
      dataFinal = now;
      dataInicial = cursor?.lastSyncedAt
        ? new Date(cursor.lastSyncedAt.getTime() - incrementalDays * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    }

    // Buscar contas recebidas
    let contas = await listAllContasReceber(
      connection,
      dataInicial,
      dataFinal,
      "pago"
    );
    
    // Limitar em modo dev
    const isDevMode = options?.startDate && options?.endDate && !options?.isCron;
    if (isDevMode && contas.length > 10) {
      console.log(`[Sync ${module}] MODO DEV: Limitando de ${contas.length} para 10 contas`);
      contas = contas.slice(0, 10);
    }
    
    console.log(`[Sync ${module}] Processando ${contas.length} contas recebidas`);
    
    const titulosProcessados: bigint[] = [];
    
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
        
        titulosProcessados.push(contaView.tituloId);
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Conta ${conta.id}: ${msg}`);
      }
    }

    // LIMPEZA: Remover de vw_contas_receber_posicao as contas que foram recebidas
    if (titulosProcessados.length > 0) {
      try {
        const deleted = await prisma.vwContasReceberPosicao.deleteMany({
          where: {
            companyId,
            tituloId: { in: titulosProcessados },
          },
        });
        
        if (deleted.count > 0) {
          console.log(`[Sync ${module}] 🧹 Removidas ${deleted.count} contas recebidas de vw_contas_receber_posicao`);
        }
      } catch (err) {
        console.warn(`[Sync ${module}] Aviso: Erro ao limpar contas recebidas de vw_contas_receber_posicao:`, err);
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
// SYNC DE ESTOQUE (Snapshot Diário)
// ============================================

const syncEstoque = async (
  companyId: string,
  connection: TinyConnection,
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean }
): Promise<ModuleResult> => {
  const module = "vw_estoque";
  const errors: string[] = [];
  let processed = 0;
  let skipped = 0;

  try {
    // Estoque é um snapshot, sempre busca posição completa atual
    const now = new Date();
    const dataSnapshot = now;
    
    // Detectar modo dev
    const isDevMode = options?.startDate && options?.endDate && !options?.isCron;
    const maxPages = isDevMode ? 1 : Infinity; // Limitar a 1 página em modo dev (~50 produtos)

    if (!isDevMode) {
      console.log(`[Sync ${module}] Aguardando 5s para evitar rate limit...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos de pausa
    } else {
      console.log(`[Sync ${module}] MODO DEV: Pulando delay e limitando a ${maxPages} páginas`);
    }

    console.log(`[Sync ${module}] Buscando e processando produtos em streaming...`);

    // Buscar e processar produtos PÁGINA POR PÁGINA (streaming)
    // Se der erro em uma página, já teremos salvo as anteriores
    const { listProdutos } = await import("@/lib/tiny/api");
    let pagina = 1;
    let hasMore = true;
    let totalProdutos = 0;

    while (hasMore) {
      try {
        const response = await listProdutos(connection, pagina);
        
        if (!response.itens || response.itens.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`[Sync ${module}] Processando página ${pagina}: ${response.itens.length} produtos`);
        
        // Processar IMEDIATAMENTE cada produto desta página
        for (const produto of response.itens) {
          try {
            const estoqueView = transformProdutoToEstoque(companyId, produto, dataSnapshot);

            await prisma.vwEstoque.upsert({
              where: { id: estoqueView.id as string },
              create: estoqueView,
              update: {
                produto: estoqueView.produto,
                categoria: estoqueView.categoria,
                unidadeMedida: estoqueView.unidadeMedida,
                estoqueInicial: estoqueView.estoqueInicial,
                entradas: estoqueView.entradas,
                saidas: estoqueView.saidas,
                ajustes: estoqueView.ajustes,
                estoqueFinal: estoqueView.estoqueFinal,
                custoMedio: estoqueView.custoMedio,
                valorTotalEstoque: estoqueView.valorTotalEstoque,
                fornecedorUltimaCompra: estoqueView.fornecedorUltimaCompra,
                dataUltimaCompra: estoqueView.dataUltimaCompra,
              },
            });
            processed++;
          } catch (upsertErr) {
            const msg = upsertErr instanceof Error ? upsertErr.message : String(upsertErr);
            console.warn(`[Sync] Pulando produto ${produto.sku ?? produto.codigo ?? produto.id}: ${msg.substring(0, 100)}`);
            errors.push(`Produto ${produto.sku ?? produto.codigo ?? produto.id}: ${msg.split("\n")[0]}`);
            skipped++;
          }
        }

        totalProdutos += response.itens.length;
        console.log(`[Sync ${module}] Salvos ${processed} de ${totalProdutos} produtos até agora`);

        // Verificar se há mais páginas
        hasMore = response.numero_paginas ? pagina < response.numero_paginas : response.itens.length >= 50;
        
        // Limitar páginas em modo dev
        if (pagina >= maxPages) {
          console.log(`[Sync ${module}] MODO DEV: Limite de ${maxPages} páginas atingido`);
          hasMore = false;
        }
        
        if (hasMore) {
          pagina++;
          // Delay entre páginas
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (pageErr) {
        // Se der erro em uma página, logar mas NÃO abortar tudo
        const msg = pageErr instanceof Error ? pageErr.message : String(pageErr);
        console.error(`[Sync ${module}] Erro na página ${pagina}: ${msg}`);
        errors.push(`Página ${pagina}: ${msg}`);
        
        // Se for rate limit, parar aqui (já salvamos o que conseguimos)
        if (msg.includes("429")) {
          console.warn(`[Sync ${module}] Rate limit atingido. Salvos ${processed} produtos até a página ${pagina-1}.`);
          break;
        }
        
        // Para outros erros, tentar próxima página
        pagina++;
      }
    }

    console.log(`[Sync ${module}] Total processado: ${processed} produtos de ${totalProdutos} encontrados`);

    // Atualizar cursor (última data de snapshot)
    await updateSyncCursor(companyId, module, dataSnapshot);

    return {
      module,
      processed,
      skipped,
      errors: errors.length ? errors : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Sync] FATAL no módulo ${module}:`, msg);
    return { module, processed: 0, skipped: 0, errors: [msg] };
  }
};

// ============================================
// ORQUESTRADOR PRINCIPAL
// ============================================

const syncByModule = async (
  companyId: string,
  connection: TinyConnection,
  modules: SyncModule[] = ALL_MODULES,
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean }
): Promise<ModuleResult[]> => {
  const results: ModuleResult[] = [];

  for (const mod of modules) {
    console.log(`[Sync] Iniciando ${mod} para company ${companyId}`);

    let result: ModuleResult;

    switch (mod) {
      case "vw_vendas":
        result = await syncVendas(companyId, connection, options);
        break;
      case "vw_contas_receber_posicao":
        result = await syncContasReceberPosicao(companyId, connection, options);
        break;
      case "vw_contas_pagar":
        result = await syncContasPagar(companyId, connection, options);
        break;
      case "vw_contas_pagas":
        result = await syncContasPagas(companyId, connection, options);
        break;
      case "vw_contas_recebidas":
        result = await syncContasRecebidas(companyId, connection, options);
        break;
      case "vw_estoque":
        result = await syncEstoque(companyId, connection, options);
        break;
      default:
        result = { module: mod, processed: 0, skipped: 0, errors: ["Módulo não implementado"] };
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
  const SYNC_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutos (permite processar todos os módulos)
  const syncStartTime = Date.now();

  console.log("[Sync] Iniciando sincronização...", {
    companyId: options.companyId ?? "todas",
    triggeredBy: options.triggeredByUserId ?? "system",
    isCron: options.isCron ?? false,
    timeoutMs: SYNC_TIMEOUT_MS,
  });

  const companies = await prisma.company.findMany({
    where: options.companyId ? { id: options.companyId } : undefined,
    include: {
      connections: {
        take: 1,
      },
    },
  });

  if (companies.length === 0) {
    console.log("[Sync] Nenhuma empresa encontrada");
    return {
      runIds: [],
      message: options.companyId
        ? "Empresa não encontrada"
        : "Nenhuma empresa cadastrada",
    };
  }

  const runIds: string[] = [];
  const results: { companyId: string; companyName: string; status: string; error?: string }[] = [];

  for (const company of companies) {
    const connection = company.connections[0];// Sempre criar SyncRun, mesmo se não tiver conexão
    const run = await createRun(company.id, options.triggeredByUserId);
    runIds.push(run.id);

    // Verificar se tem conexão Tiny
    if (!connection) {
      console.log(`[Sync] ${company.name}: Sem conexão Tiny, pulando...`);await finishRun(
        run.id,
        SyncStatus.FAILED,
        [],
        "TinyConnection não encontrada. Conecte a empresa ao Tiny em /admin/conexoes-tiny"
      );
      results.push({
        companyId: company.id,
        companyName: company.name,
        status: "skipped",
        error: "Sem conexão Tiny",
      });
      continue;
    }

    console.log(`[Sync] Iniciando sync para ${company.name} (${company.id})`);
    console.log(`[Sync] Conexão Tiny: ${connection.accountName ?? connection.accountId ?? "unknown"}`);

    // Verificar timeout global
    if (Date.now() - syncStartTime > SYNC_TIMEOUT_MS) {
      console.error(`[Sync] TIMEOUT GLOBAL - sync excedeu ${SYNC_TIMEOUT_MS/1000}s`);
      await finishRun(
        run.id,
        SyncStatus.FAILED,
        [],
        `Timeout global - sync excedeu ${SYNC_TIMEOUT_MS/1000}s`
      );
      results.push({
        companyId: company.id,
        companyName: company.name,
        status: "failed",
        error: "Timeout global",
      });
      continue;
    }    try {
      const stats = await syncByModule(
        company.id,
        connection,
        options.modules ?? ALL_MODULES,
        {
          startDate: options.startDate,
          endDate: options.endDate,
          isCron: options.isCron,
        }
      );
      const hasErrors = stats.some((s) => s.errors && s.errors.length > 0);
      const totalProcessed = stats.reduce((sum, s) => sum + s.processed, 0);

      const errorSummary = hasErrors
        ? stats
            .filter((s) => s.errors && s.errors.length > 0)
            .map((s) => `${s.module}: ${s.errors?.slice(0, 2).join(", ")}${(s.errors?.length ?? 0) > 2 ? "..." : ""}`)
            .join("; ")
        : undefined;

      await finishRun(
        run.id,
        hasErrors ? SyncStatus.FAILED : SyncStatus.SUCCESS,
        stats,
        errorSummary
      );

      await logAudit(company.id, options.triggeredByUserId, !hasErrors, stats);

      results.push({
        companyId: company.id,
        companyName: company.name,
        status: hasErrors ? "partial" : "success",
        error: errorSummary,
      });

      console.log(
        `[Sync] Finalizado para ${company.name}: ${totalProcessed} registros processados${hasErrors ? " (com erros)" : ""}`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Falha desconhecida";
      const errorStack = err instanceof Error ? err.stack : undefined;console.error(`[Sync] Erro crítico para ${company.name}:`, errorMessage);
      if (errorStack) {
        console.error("[Sync] Stack:", errorStack.split("\n").slice(0, 5).join("\n"));
      }

      await finishRun(run.id, SyncStatus.FAILED, [], errorMessage);
      await logAudit(company.id, options.triggeredByUserId, false);

      results.push({
        companyId: company.id,
        companyName: company.name,
        status: "error",
        error: errorMessage,
      });
    }
  }

  console.log("[Sync] Sincronização finalizada", {
    totalCompanies: companies.length,
    synced: results.filter((r) => r.status === "success").length,
    partial: results.filter((r) => r.status === "partial").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  });

  return { runIds, results };
}
