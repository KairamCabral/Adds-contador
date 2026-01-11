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
  listContasPagas,
  listContasRecebidas,
} from "@/lib/tiny/api";
import { loadProdutoCacheMap, pickCategoriaFromCache } from "@/lib/tiny/produto-cache";
import { transformPedidoDetalheToVendas } from "@/lib/tiny/transformers";

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
  const CHUNK_SIZE = 10;
  
  try {
    // Cursor: { pedidosProcessados: number[], allPedidos?: any[] }
    let allPedidos = cursor.allPedidos as any[] | undefined;
    const pedidosProcessados = (cursor.pedidosProcessados as string[]) || [];

    // Se não temos a lista completa, buscar
    if (!allPedidos) {
      console.log(`[ChunkVendas] Buscando pedidos de ${startDate.toISOString()} até ${endDate.toISOString()}`);
      allPedidos = await listAllPedidos(connection, startDate, endDate);
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
    const pedidosDetalhados: any[] = [];

    for (const pedido of chunkPedidos) {
      try {
        const detalhe = await getPedido(connection, pedido.id);
        pedidosDetalhados.push(detalhe);

        // Coletar IDs de produtos
        if (detalhe.itens && Array.isArray(detalhe.itens)) {
          for (const item of detalhe.itens) {
            const produtoId = item?.produto?.id;
            if (produtoId) {
              produtoIds.add(Number(produtoId));
            }
          }
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
        const enrichedItems = detalhe.itens?.map((item: any) => {
          const produtoId = Number(item?.produto?.id);
          const cacheRow = cacheMap.get(produtoId);
          const categoria = pickCategoriaFromCache(cacheRow);

          return {
            ...item,
            produto: {
              ...item.produto,
              categoria: {
                descricao: categoria,
                caminho_completo: categoria,
              },
            },
          };
        }) || [];

        const vendasData = transformPedidoDetalheToVendas(
          companyId,
          { ...detalhe, itens: enrichedItems }
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
  try {
    const currentPage = (cursor.page as number) || 1;

    console.log(`[ChunkContasReceber] Processando página ${currentPage}`);

    const result = await listContasReceber(connection, startDate, endDate, currentPage);

    if (!result.itens || result.itens.length === 0) {
      console.log(`[ChunkContasReceber] ✓ Nenhum item na página ${currentPage}`);
      return { processed: 0, cursor: {}, done: true };
    }

    // Processar e salvar (implementação simplificada - adaptar conforme transformer)
    let processed = 0;
    for (const item of result.itens) {
      // TODO: Usar transformer apropriado
      processed++;
    }

    const hasMore = result.numero_paginas && currentPage < result.numero_paginas;

    console.log(`[ChunkContasReceber] ✓ ${processed} itens processados. Página ${currentPage}/${result.numero_paginas || 1}`);

    return {
      processed,
      cursor: { page: currentPage + 1 },
      done: !hasMore,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
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
  // Implementação similar a ContasReceber
  return { processed: 0, cursor: {}, done: true };
}

export async function processContasPagasChunk(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date,
  cursor: Record<string, unknown>
): Promise<ChunkResult> {
  // Implementação similar
  return { processed: 0, cursor: {}, done: true };
}

export async function processContasRecebidasChunk(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date,
  cursor: Record<string, unknown>
): Promise<ChunkResult> {
  // Implementação similar
  return { processed: 0, cursor: {}, done: true };
}
