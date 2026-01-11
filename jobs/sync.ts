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
  getContaPagarDetalhe,
  getContaReceberDetalhe,
  getProdutoDetalhe,
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
import { getProdutosInfo } from "@/lib/tiny/produto-cache";
import { getTinyRateLimiter } from "@/lib/tiny/rate-limiter";

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
  mode?: "incremental" | "period"; // Modo do sync: incremental (com enrichment limitado) ou period (sem enrichment)
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

// Módulos P0 (prioritários - leves, executam primeiro)
const P0_MODULES: SyncModule[] = [
  "vw_contas_receber_posicao",
  "vw_contas_pagar",
];

// Módulos P1 (secundários - contas baixadas)
const P1_MODULES: SyncModule[] = ["vw_contas_pagas", "vw_contas_recebidas"];

// Módulos P2 (estoque - snapshot diário)
const P2_MODULES: SyncModule[] = ["vw_estoque"];

// Módulos P3 (pesados - executam por último para não bloquear)
const P3_MODULES: SyncModule[] = ["vw_vendas"];

// Todos os módulos para sync completo (ordem otimizada: leves primeiro, pesados por último)
const ALL_MODULES: SyncModule[] = [...P0_MODULES, ...P1_MODULES, ...P2_MODULES, ...P3_MODULES];

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
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean; mode?: "incremental" | "period" }
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
    
    console.log(`[Sync ${module}] Encontrados ${pedidos.length} pedidos`);

    // Decidir estratégia de enrichment baseado no modo
    const isPeriodSync = options?.mode === "period";
    
    if (isPeriodSync) {
      console.log(`[Sync ${module}] ⚡ Modo PERÍODO: SEM enrichment de produtos (evita 429)`);
    } else {
      console.log(`[Sync ${module}] 🔄 Modo INCREMENTAL: enrichment inteligente com cache`);
    }

    // FASE 1: Buscar detalhes dos pedidos e coletar IDs de produtos
    const produtoIds = new Set<bigint>();
    const pedidosDetalhados: (TinyPedidoDetalhe | null)[] = [];
    
    for (const pedido of pedidos) {
      try {
        const detalhe = await getPedido(connection, pedido.id);
        pedidosDetalhados.push(detalhe);
        
        // Coletar IDs de produtos
        if (detalhe.itens && Array.isArray(detalhe.itens)) {
          for (const item of detalhe.itens) {
            const produtoId = item?.produto?.id;
            if (produtoId) {
              produtoIds.add(BigInt(produtoId));
            }
          }
        }
      } catch (err) {
        console.warn(`[Sync] Falha ao buscar pedido ${pedido.id}, pulando`);
        pedidosDetalhados.push(null); // Placeholder para manter índice
      }
    }

    console.log(`[Sync ${module}] ${produtoIds.size} produtos únicos detectados`);

    // FASE 2: Enrichment de produtos com cache inteligente
    const produtosInfo = new Map<number, any>();
    
    if (!isPeriodSync && produtoIds.size > 0) {
      try {
        // Usar sistema de cache inteligente
        const produtosMap = await getProdutosInfo(
          companyId,
          connection, // Passar conexão completa
          Array.from(produtoIds),
          {
            maxEnrich: 50, // Limite de 50 produtos novos por sync incremental
          }
        );

        // Converter para formato esperado pelo transformer
        for (const [id, info] of produtosMap.entries()) {
          produtosInfo.set(Number(id), {
            id: Number(id),
            codigo: info.sku,
            nome: info.descricao,
            categoria: {
              descricao: info.categoriaNome || "N/D",
              caminho_completo: info.categoriaCaminhoCompleto || "N/D",
            },
          });
        }

        const fromCache = Array.from(produtosMap.values()).filter(p => p.fromCache).length;
        const enriched = produtosMap.size - fromCache;
        
        console.log(
          `[Sync ${module}] ✓ ${fromCache} produtos do cache, ${enriched} enriquecidos, ${produtoIds.size - produtosMap.size} pendentes`
        );
      } catch (err) {
        console.error(`[Sync ${module}] Erro no enrichment com cache:`, err);
        // Continuar sem enrichment em caso de erro
      }
    } else if (isPeriodSync) {
      console.log(`[Sync ${module}] ⚡ Enrichment pulado (modo período)`);
    }

    // FASE 3: Processar cada pedido
    for (let i = 0; i < pedidosDetalhados.length; i++) {
      const detalhe = pedidosDetalhados[i];
      const pedido = pedidos[i];
      
      try {
        // Para cada pedido, transformar com ou sem enrichment
        let vendas;
        try {
          if (detalhe) {
            // Usar o pedido DETALHE completo (com cliente, pagamento, itens) + enrichment (se disponível)
            vendas = transformPedidoDetalheToVendas(companyId, detalhe, {
              produtos: produtosInfo,
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
    );    // Buscar apenas contas abertas para posição
    let contas = await listAllContasReceber(
      connection,
      dataInicial,
      dataFinal,
      "aberto"
    );
    
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
    
    console.log(`[Sync ${module}] Encontradas ${contas.length} contas abertas. Buscando detalhes para enriquecer categorias...`);

    const contasEnriquecidas: (unknown | null)[] = [];
    for (let i = 0; i < contas.length; i++) {
      const conta = contas[i];
      const contaId = (conta as { id: number }).id;
      
      // Delay progressivo para evitar rate limit (300ms base + 50ms por conta)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300 + (i * 50)));
      }
      
      try {
        const detalheConta = await getContaPagarDetalhe(connection, contaId);
        contasEnriquecidas.push(detalheConta);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Sync] Falha ao buscar detalhe da conta ${contaId}: ${msg.substring(0, 200)}`);
        // Usar dados da lista como fallback
        contasEnriquecidas.push(conta);
      }
    }

    console.log(`[Sync ${module}] Detalhes obtidos. Transformando ${contasEnriquecidas.length} contas...`);

    for (const contaEnriquecida of contasEnriquecidas) {
      if (!contaEnriquecida) {
        errors.push("Conta detalhe não encontrada para enriquecimento.");
        continue;
      }
      try {
        const contaView = transformContaPagarToView(companyId, contaEnriquecida);

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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const contaId = (contaEnriquecida as { id?: number })?.id || 'unknown';
        errors.push(`Conta ${contaId}: ${msg}`);
      }
    }

    // Salvar payloads enriquecidos raw em batch (fora do loop principal)
    if (contasEnriquecidas.length > 0) {
      try {
        await prisma.rawPayload.createMany({
          data: contasEnriquecidas
            .filter((conta) => conta !== null)
            .map((conta) => ({
              companyId,
              module,
              externalId: String((conta as { id: number }).id),
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
    
    console.log(`[Sync ${module}] Encontradas ${contas.length} contas pagas. Buscando detalhes para enriquecer...`);
    
    // ENRICHMENT: Buscar detalhe de cada conta para obter categoria e formaPagamento
    const contasEnriquecidas: (unknown | null)[] = [];
    for (let i = 0; i < contas.length; i++) {
      const conta = contas[i];
      const contaId = (conta as { id: number }).id;
      
      // Delay progressivo para evitar rate limit
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300 + (i * 50)));
      }
      
      try {
        const detalheConta = await getContaPagarDetalhe(connection, contaId);
        contasEnriquecidas.push(detalheConta);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Sync] Falha ao buscar detalhe da conta ${contaId}: ${msg.substring(0, 200)}`);
        contasEnriquecidas.push(conta); // Fallback to list data
      }
    }

    console.log(`[Sync ${module}] Detalhes obtidos. Transformando ${contasEnriquecidas.length} contas...`);
    
    const titulosProcessados: bigint[] = [];
    
    for (const contaEnriquecida of contasEnriquecidas) {
      if (!contaEnriquecida) continue;
      try {
        const contaView = transformContaPagaToView(companyId, contaEnriquecida);
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
        
        // Normalizar tituloId para bigint
        const tituloIdBigInt =
          typeof contaView.tituloId === "bigint"
            ? contaView.tituloId
            : BigInt(contaView.tituloId);
        titulosProcessados.push(tituloIdBigInt);
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const contaId = (contaEnriquecida as { id?: number })?.id || 'unknown';
        errors.push(`Conta ${contaId}: ${msg}`);
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
  let processed = 0;try {
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
    }// Buscar contas recebidas
    let contas = await listAllContasReceber(
      connection,
      dataInicial,
      dataFinal,
      "pago"
    );console.log(`[Sync ${module}] Encontradas ${contas.length} contas recebidas. Buscando detalhes para enriquecer categorias...`);
    
    // ENRICHMENT: Buscar detalhe de cada conta para obter categoria e outros campos completos
    const contasEnriquecidas: (unknown | null)[] = [];
    for (let i = 0; i < contas.length; i++) {
      const conta = contas[i];
      const contaId = (conta as { id: number }).id;
      
      // Delay progressivo para evitar rate limit (300ms base + 50ms por conta)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300 + (i * 50)));
      }
      
      try {
        const detalheConta = await getContaReceberDetalhe(connection, contaId);
        contasEnriquecidas.push(detalheConta);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Sync] Falha ao buscar detalhe da conta ${contaId}: ${msg.substring(0, 200)}`);
        // Usar dados da lista como fallback
        contasEnriquecidas.push(conta);
      }
    }
    
    console.log(`[Sync ${module}] Detalhes obtidos. Transformando ${contasEnriquecidas.length} contas...`);
    
    const titulosProcessados: bigint[] = [];
    
    for (const contaEnriquecida of contasEnriquecidas) {
      if (!contaEnriquecida) {
        errors.push("Conta detalhe não encontrada para enriquecimento.");
        continue;
      }
      
      try {
        const contaView = transformContaRecebidaToView(companyId, contaEnriquecida);
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
        
        // Normalizar tituloId para bigint
        const tituloIdBigInt =
          typeof contaView.tituloId === "bigint"
            ? contaView.tituloId
            : BigInt(contaView.tituloId);
        titulosProcessados.push(tituloIdBigInt);
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const contaId = (contaEnriquecida as { id?: number })?.id || 'unknown';
        errors.push(`Conta ${contaId}: ${msg}`);
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

    console.log(`[Sync ${module}] Calculando saídas a partir de vendas (últimos 30 dias)...`);
    const dataInicio = new Date(dataSnapshot);
    dataInicio.setDate(dataInicio.getDate() - 30);
    
    const vendasAgrupadas = await prisma.vwVendas.groupBy({
      by: ['produto'],
      where: {
        companyId,
        dataHora: { gte: dataInicio, lte: dataSnapshot },
        status: { notIn: ['Cancelado', 'Estornado'] }
      },
      _sum: { quantidade: true }
    });
    
    // Criar mapa: produto (normalizado) → quantidade vendida
    const saidasPorProduto = new Map<string, number>();
    vendasAgrupadas.forEach(venda => {
      const produtoKey = venda.produto.toLowerCase().trim();
      const quantidade = Number(venda._sum.quantidade || 0);
      saidasPorProduto.set(produtoKey, quantidade);
    });
    
    console.log(`[Sync ${module}] Saídas calculadas para ${saidasPorProduto.size} produtos distintos`);

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
        
        // ENRICHMENT: Buscar detalhe de cada produto para obter categoria
        const produtosEnriquecidos: (unknown | null)[] = [];
        for (let i = 0; i < response.itens.length; i++) {
          const produto = response.itens[i];
          const produtoId = (produto as { id: number }).id;
          
          // Delay progressivo para evitar rate limit
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300 + (i * 30)));
          }
          
          try {
            const detalheProduto = await getProdutoDetalhe(connection, produtoId);
            produtosEnriquecidos.push(detalheProduto);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[Sync] Falha ao buscar detalhe do produto ${produtoId}: ${msg.substring(0, 200)}`);
            produtosEnriquecidos.push(produto); // Fallback to list data
          }
        }
        
        console.log(`[Sync ${module}] Detalhes obtidos. Transformando ${produtosEnriquecidos.length} produtos...`);
        
        // Processar IMEDIATAMENTE cada produto desta página
        for (const produtoEnriquecido of produtosEnriquecidos) {
          if (!produtoEnriquecido) continue;
          try {
            const estoqueView = transformProdutoToEstoque(
              companyId, 
              produtoEnriquecido as Record<string, unknown>, 
              dataSnapshot, 
              saidasPorProduto
            );

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
            const produtoId = (produtoEnriquecido as { id?: number })?.id || 'unknown';
            console.warn(`[Sync] Pulando produto ${produtoId}: ${msg.substring(0, 100)}`);
            errors.push(`Produto ${produtoId}: ${msg.split("\n")[0]}`);
            skipped++;
          }
        }

        totalProdutos += response.itens.length;
        console.log(`[Sync ${module}] Salvos ${processed} de ${totalProdutos} produtos até agora`);

        // Verificar se há mais páginas
        hasMore = response.numero_paginas ? pagina < response.numero_paginas : response.itens.length >= 50;
        
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
  options?: { startDate?: Date; endDate?: Date; isCron?: boolean; mode?: "incremental" | "period" }
): Promise<ModuleResult[]> => {
  const results: ModuleResult[] = [];
  
  const dateRange = options?.startDate && options?.endDate 
    ? `${options.startDate.toISOString().split('T')[0]}..${options.endDate.toISOString().split('T')[0]}`
    : 'incremental';

  for (const mod of modules) {
    const moduleStartTime = Date.now();
    console.log(`[Sync] START module=${mod} range=${dateRange} company=${companyId}`);
    
    let result: ModuleResult;

    try {
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
      
      const tookMs = Date.now() - moduleStartTime;
      const hasErrors = result.errors && result.errors.length > 0;
      
      if (hasErrors) {
        console.log(
          `[Sync] END   module=${mod} processed=${result.processed} errors=${result.errors?.length || 0} tookMs=${tookMs}`
        );
        console.warn(`[Sync] ERROR module=${mod} firstError="${result.errors?.[0]?.substring(0, 100)}"`);
      } else {
        console.log(
          `[Sync] END   module=${mod} processed=${result.processed} tookMs=${tookMs}`
        );
      }
    } catch (error) {
      // CRÍTICO: Capturar erro e NÃO abortar o sync global
      const errorMessage = error instanceof Error ? error.message : String(error);
      const tookMs = Date.now() - moduleStartTime;
      
      console.error(`[Sync] ERROR module=${mod} message="${errorMessage.substring(0, 200)}" tookMs=${tookMs}`);
      
      result = {
        module: mod,
        processed: 0,
        skipped: 0,
        errors: [errorMessage]
      };
      
      results.push(result);
    }
  }
  
  return results;
};

// ============================================
// FUNÇÃO PRINCIPAL EXPORTADA
// ============================================

export async function runSync(options: SyncOptions) {
  const SYNC_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutos (permite processar todos os módulos)
  const syncStartTime = Date.now();
  const modulesRequested = options.modules ?? ALL_MODULES;

  console.log("[Sync] Iniciando sincronização...", {
    companyId: options.companyId ?? "todas",
    triggeredBy: options.triggeredByUserId ?? "system",
    isCron: options.isCron ?? false,
    modules: modulesRequested.join(", "),
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
    }
    
    try {
      const stats = await syncByModule(
        company.id,
        connection,
        options.modules ?? ALL_MODULES,
        {
          startDate: options.startDate,
          endDate: options.endDate,
          isCron: options.isCron,
          mode: options.mode,
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

  // Log FINAL obrigatório em qualquer cenário
  const totalMs = Date.now() - syncStartTime;
  const modulesRun: string[] = [];
  const modulesFailed: string[] = [];
  
  companies.forEach(company => {
    const companyResult = results.find(r => r.companyId === company.id);
    if (companyResult && companyResult.status !== "skipped") {
      // Coletar módulos que rodaram (mesmo com erros parciais)
      modulesRun.push(...modulesRequested);
    }
  });
  
  results.forEach(r => {
    if (r.status === "error") {
      modulesFailed.push(r.companyId);
    }
  });

  console.log("[Sync] DONE", {
    totalCompanies: companies.length,
    synced: results.filter((r) => r.status === "success").length,
    partial: results.filter((r) => r.status === "partial").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    modulesRun: modulesRequested,
    modulesFailed: modulesFailed.length > 0 ? modulesFailed : "none",
    totalMs,
  });

  return { runIds, results };
}

// ============================================
// EXPORTS PARA EXECUTOR RESUMABLE
// ============================================

export {
  syncVendas,
  syncContasReceberPosicao,
  syncContasPagar,
  syncContasPagas,
  syncContasRecebidas,
  syncEstoque,
};

export type { ModuleResult };
