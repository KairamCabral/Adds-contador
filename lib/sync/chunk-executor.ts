/**
 * Executor de sync em chunks pequenos (< 8s) para Vercel Hobby
 * 
 * Cada módulo é processado em chunks/steps:
 * - Vendas (period): max 10 pedidos por step
 * - Contas: 1 página por step
 * - Estoque: não roda em period
 */

import { prisma } from "@/lib/db";
import { TinyConnection } from "@prisma/client";
import { 
  listAllPedidos, 
  getPedido,
  listContasReceber,
  listContasPagar,
  getContaReceberDetalhe,
  getContaPagarDetalhe,
} from "@/lib/tiny/api";
import { loadProdutoCacheMap, pickCategoriaFromCache } from "@/lib/tiny/produto-cache";
import { 
  transformPedidoDetalheToVendas,
  transformContaReceberToPosicao,
  transformContaPagarToView,
  transformContaPagaToView,
  transformContaRecebidaToView,
} from "@/lib/tiny/transformers";

// Tipos auxiliares
type TinyPedido = {
  id: number | string;
  [key: string]: unknown;
};

type TinyPedidoDetalhe = TinyPedido & {
  itens?: Array<{
    produto?: {
      id?: number | string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
};

export type ChunkResult = {
  processed: number;
  cursor: Record<string, unknown>;
  done: boolean;
  error?: string;
};

/**
 * Processa um chunk de vendas (modo período)
 * Limita a 10 pedidos por step
 */
export async function processVendasChunk(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date,
  cursor: Record<string, unknown>
): Promise<ChunkResult> {
  const CHUNK_SIZE = 50; // ✅ Aumentado de 10 para 50 (sincronização mais rápida)
  
  try {
    // Cursor com tipos seguros
    let allPedidos = cursor.allPedidos as TinyPedido[] | undefined;
    const pedidosProcessados = (cursor.pedidosProcessados as string[]) || [];

    // Se não temos a lista completa, buscar
    if (!allPedidos) {
      console.log(`[ChunkVendas] Buscando pedidos de ${startDate.toISOString()} até ${endDate.toISOString()}`);
      const resultado = await listAllPedidos(connection, startDate, endDate);
      allPedidos = resultado as TinyPedido[];
      console.log(`[ChunkVendas] Encontrados ${allPedidos.length} pedidos`);
    }

    // Filtrar pedidos ainda não processados
    const pendingPedidos = allPedidos.filter(p => !pedidosProcessados.includes(String(p.id)));
    
    if (pendingPedidos.length === 0) {
      console.log(`[ChunkVendas] ✓ Todos os pedidos foram processados`);
      return { processed: 0, cursor: {}, done: true };
    }

    // Pegar chunk
    const chunkPedidos = pendingPedidos.slice(0, CHUNK_SIZE);
    console.log(`[ChunkVendas] Processando ${chunkPedidos.length} de ${pendingPedidos.length} pedidos pendentes`);

    // Buscar detalhes e coletar produtos
    const produtoIds = new Set<number>();
    const pedidosDetalhados: (TinyPedidoDetalhe | null)[] = [];

    for (let i = 0; i < chunkPedidos.length; i++) {
      const pedido = chunkPedidos[i];
      try {
        const detalhe = await getPedido(connection, Number(pedido.id));
        const pedidoTipado = detalhe as TinyPedidoDetalhe;
        pedidosDetalhados.push(pedidoTipado);

        // Coletar IDs de produtos
        if (pedidoTipado.itens && Array.isArray(pedidoTipado.itens)) {
          for (const item of pedidoTipado.itens) {
            const produtoId = item?.produto?.id;
            if (produtoId) {
              produtoIds.add(Number(produtoId));
            }
          }
        }

        // ✅ Delay entre pedidos para evitar rate limit (300ms)
        if (i < chunkPedidos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (err) {
        console.warn(`[ChunkVendas] Falha ao buscar pedido ${pedido.id}:`, err);
        pedidosDetalhados.push(null);
      }
    }

    // Carregar cache de produtos
    const cacheMap = await loadProdutoCacheMap(companyId, Array.from(produtoIds));

    // Processar pedidos
    let processed = 0;
    for (const detalhe of pedidosDetalhados) {
      if (!detalhe) continue;

      try {
        // Enriquecer produtos do pedido com cache
        const enrichedItems = detalhe.itens?.map((item) => {
          const produtoId = Number(item?.produto?.id);
          const cacheRow = cacheMap.get(produtoId);
          const categoria = pickCategoriaFromCache(cacheRow);

          return {
            ...item,
            produto: {
              ...item.produto,
              id: produtoId, // Garantir que id seja number
              categoria: {
                descricao: categoria,
                caminho_completo: categoria,
              },
            },
          };
        }) || [];

        const vendasData = transformPedidoDetalheToVendas(
          companyId,
          { 
            ...detalhe, 
            id: Number(detalhe.id), // Converter id do pedido para number
            itens: enrichedItems 
          }
        );

        // Salvar cada venda
        for (const venda of vendasData) {
          await prisma.vwVendas.upsert({
            where: { id: venda.id as string },
            create: venda,
            update: venda,
          });
          processed++;
        }

        pedidosProcessados.push(String(detalhe.id));
      } catch (err) {
        console.warn(`[ChunkVendas] Erro ao processar pedido ${detalhe.id}:`, err);
      }
    }

    // Atualizar cursor
    const newCursor = {
      allPedidos,
      pedidosProcessados,
    };

    const done = pedidosProcessados.length >= allPedidos.length;

    console.log(`[ChunkVendas] ✓ ${processed} vendas processadas. Progress: ${pedidosProcessados.length}/${allPedidos.length}`);

    return {
      processed,
      cursor: newCursor,
      done,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ChunkVendas] Erro:`, errorMsg);
    return {
      processed: 0,
      cursor,
      done: false,
      error: errorMsg,
    };
  }
}

/**
 * Processa um chunk de contas a receber
 * 1 página por step
 */
export async function processContasReceberChunk(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date,
  cursor: Record<string, unknown>
): Promise<ChunkResult> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000; // 5 segundos entre tentativas
  
  try {
    const currentPage = (cursor.page as number) || 1;
    const retryCount = (cursor.retryCount as number) || 0;

    const dataInicial = startDate.toISOString().split('T')[0];
    const dataFinal = endDate.toISOString().split('T')[0];
    
    console.log(`[ChunkContasReceber] Processando página ${currentPage}, período: ${dataInicial} a ${dataFinal}${retryCount > 0 ? ` (tentativa ${retryCount + 1}/${MAX_RETRIES})` : ''}`);

    const result = await listContasReceber(connection, {
      pagina: currentPage,
      dataInicial,
      dataFinal,
    });

    if (!result.itens || result.itens.length === 0) {
      console.log(`[ChunkContasReceber] ✓ Nenhum item na página ${currentPage}`);
      return { processed: 0, cursor: {}, done: true };
    }

    // Processar e salvar COM ENRICHMENT (buscar detalhe para obter categoria)
    let processed = 0;
    for (const item of result.itens) {
      try {
        // 🔥 ENRICHMENT: Buscar detalhe da conta (que inclui categoria!)
        let contaComDetalhe: unknown = item;
        try {
          console.log(`[ChunkContasReceber] 🔍 Buscando detalhe da conta ${item.id}...`);
          const detalhe = await getContaReceberDetalhe(connection, Number(item.id));
          contaComDetalhe = detalhe;
          console.log(`[ChunkContasReceber] ✓ Detalhe obtido para conta ${item.id}`);
          
          // Delay de 100ms para evitar rate limit (otimizado)
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (errDetalhe) {
          const errMsg = errDetalhe instanceof Error ? errDetalhe.message : String(errDetalhe);
          console.warn(`[ChunkContasReceber] ⚠ Erro ao buscar detalhe da conta ${item.id}, usando dados da lista:`, errMsg);
          // Fallback: usa conta original sem categoria
        }

        const contaData = transformContaReceberToPosicao(companyId, contaComDetalhe);
        await prisma.vwContasReceberPosicao.upsert({
          where: { id: contaData.id as string },
          create: contaData,
          update: contaData,
        });
        processed++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[ChunkContasReceber] Erro ao processar conta ${item.id}:`, errMsg);
      }
    }

    const hasMore = result.numero_paginas && currentPage < result.numero_paginas;

    console.log(`[ChunkContasReceber] ✓ ${processed} itens processados. Página ${currentPage}/${result.numero_paginas || 1}`);

    return {
      processed,
      cursor: { page: currentPage + 1, retryCount: 0 },
      done: !hasMore,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const retryCount = (cursor.retryCount as number) || 0;
    
    // 🔄 Se for erro 400 (timeout) e ainda tem tentativas, retry
    if (errorMsg.includes('400') && errorMsg.includes('muito tempo') && retryCount < MAX_RETRIES - 1) {
      console.warn(`[ChunkContasReceber] ⚠ Timeout na página ${cursor.page || 1}. Aguardando ${RETRY_DELAY/1000}s para tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return {
        processed: 0,
        cursor: { ...cursor, retryCount: retryCount + 1 },
        done: false,
      };
    }
    
    // ❌ Após 3 tentativas ou erro diferente, pular esta página
    if (retryCount >= MAX_RETRIES - 1) {
      console.error(`[ChunkContasReceber] ❌ Falha após ${MAX_RETRIES} tentativas. Pulando página ${cursor.page || 1}.`);
      const currentPage = (cursor.page as number) || 1;
      return {
        processed: 0,
        cursor: { page: currentPage + 1, retryCount: 0 },
        done: false, // Continua para próxima página
      };
    }
    
    console.error(`[ChunkContasReceber] Erro:`, errorMsg);
    return {
      processed: 0,
      cursor,
      done: false,
      error: errorMsg,
    };
  }
}

// Exports similares para outros módulos...
export async function processContasPagarChunk(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date,
  cursor: Record<string, unknown>
): Promise<ChunkResult> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000; // 5 segundos entre tentativas
  
  try {
    const currentPage = (cursor.page as number) || 1;
    const retryCount = (cursor.retryCount as number) || 0;

    const dataInicial = startDate.toISOString().split('T')[0];
    const dataFinal = endDate.toISOString().split('T')[0];
    
    console.log(`[ChunkContasPagar] Processando página ${currentPage}, período: ${dataInicial} a ${dataFinal}${retryCount > 0 ? ` (tentativa ${retryCount + 1}/${MAX_RETRIES})` : ''}`);

    const result = await listContasPagar(connection, {
      pagina: currentPage,
      dataInicial,
      dataFinal,
    });

    if (!result.itens || result.itens.length === 0) {
      console.log(`[ChunkContasPagar] ✓ Nenhum item na página ${currentPage}`);
      return { processed: 0, cursor: {}, done: true };
    }

    // Processar e salvar COM ENRICHMENT (buscar detalhe para obter categoria)
    let processed = 0;
    for (const item of result.itens) {
      try {
        // 🔥 ENRICHMENT: Buscar detalhe da conta (que inclui categoria!)
        let contaComDetalhe: unknown = item;
        try {
          console.log(`[ChunkContasPagar] 🔍 Buscando detalhe da conta ${item.id}...`);
          const detalhe = await getContaPagarDetalhe(connection, Number(item.id));
          contaComDetalhe = detalhe;
          console.log(`[ChunkContasPagar] ✓ Detalhe obtido para conta ${item.id}`);
          
          // Delay de 100ms para evitar rate limit (otimizado)
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (errDetalhe) {
          const errMsg = errDetalhe instanceof Error ? errDetalhe.message : String(errDetalhe);
          console.warn(`[ChunkContasPagar] ⚠ Erro ao buscar detalhe da conta ${item.id}, usando dados da lista:`, errMsg);
          // Fallback: usa conta original sem categoria
        }

        const contaData = transformContaPagarToView(companyId, contaComDetalhe);
        await prisma.vwContasPagar.upsert({
          where: { id: contaData.id as string },
          create: contaData,
          update: contaData,
        });
        processed++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[ChunkContasPagar] Erro ao processar conta ${item.id}:`, errMsg);
      }
    }

    const hasMore = result.numero_paginas && currentPage < result.numero_paginas;

    console.log(`[ChunkContasPagar] ✓ ${processed} itens processados. Página ${currentPage}/${result.numero_paginas || 1}`);

    return {
      processed,
      cursor: { page: currentPage + 1, retryCount: 0 },
      done: !hasMore,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const retryCount = (cursor.retryCount as number) || 0;
    
    // 🔄 Se for erro 400 (timeout) e ainda tem tentativas, retry
    if (errorMsg.includes('400') && errorMsg.includes('muito tempo') && retryCount < MAX_RETRIES - 1) {
      console.warn(`[ChunkContasPagar] ⚠ Timeout na página ${cursor.page || 1}. Aguardando ${RETRY_DELAY/1000}s para tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return {
        processed: 0,
        cursor: { ...cursor, retryCount: retryCount + 1 },
        done: false,
      };
    }
    
    // ❌ Após 3 tentativas ou erro diferente, pular esta página
    if (retryCount >= MAX_RETRIES - 1) {
      console.error(`[ChunkContasPagar] ❌ Falha após ${MAX_RETRIES} tentativas. Pulando página ${cursor.page || 1}.`);
      const currentPage = (cursor.page as number) || 1;
      return {
        processed: 0,
        cursor: { page: currentPage + 1, retryCount: 0 },
        done: false, // Continua para próxima página
      };
    }
    
    console.error(`[ChunkContasPagar] Erro:`, errorMsg);
    return {
      processed: 0,
      cursor,
      done: false,
      error: errorMsg,
    };
  }
}

/**
 * Processa um chunk de contas pagas
 * Busca contas a pagar do período e filtra apenas as que foram pagas
 */
export async function processContasPagasChunk(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date,
  cursor: Record<string, unknown>
): Promise<ChunkResult> {
  try {
    const currentPage = (cursor.page as number) || 1;
    
    // ✅ OTIMIZADO: Buscar apenas 7 dias antes (reduzido para evitar timeouts da API Tiny)
    const searchStartDate = new Date(startDate);
    searchStartDate.setDate(searchStartDate.getDate() - 7);
    
    const dataInicialBusca = searchStartDate.toISOString().split('T')[0];
    const dataFinalBusca = endDate.toISOString().split('T')[0];
    const dataInicialFiltro = startDate.toISOString().split('T')[0];
    const dataFinalFiltro = endDate.toISOString().split('T')[0];
    
    console.log(`[ChunkContasPagas] Página ${currentPage}`);
    console.log(`[ChunkContasPagas] Buscando por vencimento: ${dataInicialBusca} a ${dataFinalBusca}`);
    console.log(`[ChunkContasPagas] Filtrando por pagamento: ${dataInicialFiltro} a ${dataFinalFiltro}`);

    // Buscar contas a pagar (por data de vencimento)
    const result = await listContasPagar(connection, {
      pagina: currentPage,
      dataInicial: dataInicialBusca,
      dataFinal: dataFinalBusca,
    });

    if (!result.itens || result.itens.length === 0) {
      console.log(`[ChunkContasPagas] ✓ Nenhum item na página ${currentPage}`);
      return { processed: 0, cursor: {}, done: true };
    }

    console.log(`[ChunkContasPagas] Analisando ${result.itens.length} contas...`);

    // Processar e salvar apenas as pagas (com enriquecimento de dados)
    let processed = 0;
    let skippedNotPaid = 0;
    let skippedOutOfRange = 0;
    
    for (const item of result.itens) {
      try {
        // ✅ OTIMIZAÇÃO: Verificar se está paga ANTES de buscar detalhe (evita chamadas desnecessárias)
        const itemObj = item as Record<string, unknown>;
        if (itemObj.situacao !== "pago") {
          skippedNotPaid++;
          continue; // Pula para o próximo item sem fazer chamada à API
        }
        
        // ✅ ENRIQUECIMENTO: Buscar detalhe completo da conta (inclui categoria, valores corretos, etc)
        const itemEnriquecido = await getContaPagarDetalhe(connection, item.id);
        
        // Delay aumentado para evitar rate limit (429)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Transformer retorna null se não estiver pago (situacao !== "pago")
        const contaPagaData = transformContaPagaToView(companyId, itemEnriquecido);
        
        if (contaPagaData) {
          // Filtrar por data de pagamento dentro do período selecionado
          const dataPagamento = contaPagaData.dataPagamento as Date;
          const dataPagamentoStr = dataPagamento.toISOString().split('T')[0];
          
          if (dataPagamento >= startDate && dataPagamento <= endDate) {
            console.log(`[ChunkContasPagas] ✓ Conta ${item.id} paga em ${dataPagamentoStr} - ${contaPagaData.fornecedor} - R$ ${contaPagaData.valorPago}`);
            
            await prisma.vwContasPagas.upsert({
              where: { id: contaPagaData.id as string },
              create: contaPagaData,
              update: contaPagaData,
            });
            processed++;
          } else {
            console.log(`[ChunkContasPagas] ⊘ Conta ${item.id} paga fora do período: ${dataPagamentoStr}`);
            skippedOutOfRange++;
          }
        }
      } catch (err) {
        console.warn(`[ChunkContasPagas] Erro ao processar conta ${item.id}:`, err);
      }
    }

    // ✅ Melhor detecção de paginação (quando API não retorna numero_paginas)
    const hasMore = result.numero_paginas 
      ? currentPage < result.numero_paginas 
      : result.itens.length >= 100; // Se retornou 100 itens, provavelmente tem mais
    
    console.log(`[ChunkContasPagas] ✓ Página ${currentPage}/${result.numero_paginas || '?'}: ${processed} salvas | ${skippedNotPaid} não pagas | ${skippedOutOfRange} fora do período`);

    return {
      processed,
      cursor: hasMore ? { page: currentPage + 1 } : {},
      done: !hasMore,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // ✅ Tratar timeout (400) sem falhar sync inteiro
    if (errorMsg.includes('400') && errorMsg.includes('tempo')) {
      console.warn(`[ChunkContasPagas] ⚠️  Timeout da API Tiny - concluindo módulo`);
      return {
        processed: 0,
        cursor: {},
        done: true, // Marcar como concluído para não travar o sync
      };
    }
    
    console.error(`[ChunkContasPagas] Erro:`, errorMsg);
    return {
      processed: 0,
      cursor,
      done: false,
      error: errorMsg,
    };
  }
}

/**
 * Processa um chunk de contas recebidas
 * Busca contas a receber do período e filtra apenas as que foram recebidas
 */
export async function processContasRecebidasChunk(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date,
  cursor: Record<string, unknown>
): Promise<ChunkResult> {
  try {
    const currentPage = (cursor.page as number) || 1;
    
    // ✅ OTIMIZADO: Buscar apenas 7 dias antes (reduzido para evitar timeouts da API Tiny)
    const searchStartDate = new Date(startDate);
    searchStartDate.setDate(searchStartDate.getDate() - 7);
    
    const dataInicialBusca = searchStartDate.toISOString().split('T')[0];
    const dataFinalBusca = endDate.toISOString().split('T')[0];
    const dataInicialFiltro = startDate.toISOString().split('T')[0];
    const dataFinalFiltro = endDate.toISOString().split('T')[0];
    
    console.log(`[ChunkContasRecebidas] Página ${currentPage}`);
    console.log(`[ChunkContasRecebidas] Buscando por vencimento: ${dataInicialBusca} a ${dataFinalBusca}`);
    console.log(`[ChunkContasRecebidas] Filtrando por recebimento: ${dataInicialFiltro} a ${dataFinalFiltro}`);

    // Buscar contas a receber (por data de vencimento)
    const result = await listContasReceber(connection, {
      pagina: currentPage,
      dataInicial: dataInicialBusca,
      dataFinal: dataFinalBusca,
    });

    if (!result.itens || result.itens.length === 0) {
      console.log(`[ChunkContasRecebidas] ✓ Nenhum item na página ${currentPage}`);
      return { processed: 0, cursor: {}, done: true };
    }

    console.log(`[ChunkContasRecebidas] Analisando ${result.itens.length} contas...`);

    // Processar e salvar apenas as recebidas (com enriquecimento de dados)
    let processed = 0;
    let skippedNotPaid = 0;
    let skippedOutOfRange = 0;
    
    for (const item of result.itens) {
      try {
        // ✅ OTIMIZAÇÃO: Verificar se está recebida ANTES de buscar detalhe (evita chamadas desnecessárias)
        const itemObj = item as Record<string, unknown>;
        if (itemObj.situacao !== "pago") {
          skippedNotPaid++;
          continue; // Pula para o próximo item sem fazer chamada à API
        }
        
        // ✅ ENRIQUECIMENTO: Buscar detalhe completo da conta (inclui categoria, valores corretos, etc)
        const itemEnriquecido = await getContaReceberDetalhe(connection, item.id);
        
        // Delay aumentado para evitar rate limit (429)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Transformer retorna null se não estiver recebido (situacao !== "pago")
        const contaRecebidaData = transformContaRecebidaToView(companyId, itemEnriquecido);
        
        if (contaRecebidaData) {
          // Filtrar por data de recebimento dentro do período selecionado
          const dataRecebimento = contaRecebidaData.dataRecebimento as Date;
          const dataRecebimentoStr = dataRecebimento.toISOString().split('T')[0];
          
          if (dataRecebimento >= startDate && dataRecebimento <= endDate) {
            console.log(`[ChunkContasRecebidas] ✓ Conta ${item.id} recebida em ${dataRecebimentoStr} - ${contaRecebidaData.cliente} - R$ ${contaRecebidaData.valorRecebido}`);
            
            await prisma.vwContasRecebidas.upsert({
              where: { id: contaRecebidaData.id as string },
              create: contaRecebidaData,
              update: contaRecebidaData,
            });
            processed++;
          } else {
            console.log(`[ChunkContasRecebidas] ⊘ Conta ${item.id} recebida fora do período: ${dataRecebimentoStr}`);
            skippedOutOfRange++;
          }
        }
      } catch (err) {
        console.warn(`[ChunkContasRecebidas] Erro ao processar conta ${item.id}:`, err);
      }
    }

    // ✅ Melhor detecção de paginação (quando API não retorna numero_paginas)
    const hasMore = result.numero_paginas 
      ? currentPage < result.numero_paginas 
      : result.itens.length >= 100; // Se retornou 100 itens, provavelmente tem mais
    
    console.log(`[ChunkContasRecebidas] ✓ Página ${currentPage}/${result.numero_paginas || '?'}: ${processed} salvas | ${skippedNotPaid} não pagas | ${skippedOutOfRange} fora do período`);

    return {
      processed,
      cursor: hasMore ? { page: currentPage + 1 } : {},
      done: !hasMore,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // ✅ Tratar timeout (400) sem falhar sync inteiro
    if (errorMsg.includes('400') && errorMsg.includes('tempo')) {
      console.warn(`[ChunkContasRecebidas] ⚠️  Timeout da API Tiny - concluindo módulo`);
      return {
        processed: 0,
        cursor: {},
        done: true, // Marcar como concluído para não travar o sync
      };
    }
    
    console.error(`[ChunkContasRecebidas] Erro:`, errorMsg);
    return {
      processed: 0,
      cursor,
      done: false,
      error: errorMsg,
    };
  }
}
