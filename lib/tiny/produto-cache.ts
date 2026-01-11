/**
 * Serviço de cache persistente para produtos do Tiny ERP
 * 
 * Funcionalidades:
 * - Cache em banco de dados (Prisma)
 * - Consulta em lote para múltiplos produtos
 * - Enriquecimento inteligente (somente produtos não cacheados)
 * - Rate limiting integrado
 */

import { prisma } from "@/lib/db";
import { getProdutoDetalhe } from "./api";
import { getTinyRateLimiter } from "./rate-limiter";
import { TinyConnection } from "@prisma/client";

export interface ProdutoInfo {
  produtoId: bigint;
  sku?: string;
  descricao: string;
  categoriaNome?: string;
  categoriaCaminhoCompleto?: string;
  fromCache: boolean;
}

export interface EnrichmentOptions {
  /** Limite máximo de produtos a enriquecer por execução (padrão: 50) */
  maxEnrich?: number;
  /** Se true, força atualização mesmo se já existir no cache */
  forceRefresh?: boolean;
}

/**
 * Busca informações de produtos, usando cache quando disponível
 */
export async function getProdutosInfo(
  companyId: string,
  connection: TinyConnection,
  produtoIds: bigint[],
  options: EnrichmentOptions = {}
): Promise<Map<bigint, ProdutoInfo>> {
  const result = new Map<bigint, ProdutoInfo>();
  
  if (produtoIds.length === 0) {
    return result;
  }

  const uniqueIds = Array.from(new Set(produtoIds.map(id => id.toString()))).map(id => BigInt(id));
  
  console.log(`[ProdutoCache] Consultando ${uniqueIds.length} produtos únicos`);

  // FASE 1: Consultar cache em lote
  const cached = await prisma.tinyProdutoCache.findMany({
    where: {
      companyId,
      produtoId: { in: uniqueIds },
    },
  });

  console.log(`[ProdutoCache] ${cached.length} produtos encontrados no cache`);

  // Mapear produtos cacheados
  const cachedMap = new Map<string, typeof cached[0]>();
  for (const item of cached) {
    cachedMap.set(item.produtoId.toString(), item);
    result.set(item.produtoId, {
      produtoId: item.produtoId,
      sku: item.sku || undefined,
      descricao: item.descricao,
      categoriaNome: item.categoriaNome || undefined,
      categoriaCaminhoCompleto: item.categoriaCaminhoCompleto || undefined,
      fromCache: true,
    });
  }

  // FASE 2: Identificar produtos faltando
  const missing = uniqueIds.filter((id) => !cachedMap.has(id.toString()));

  if (missing.length === 0) {
    console.log(`[ProdutoCache] Todos os produtos estavam no cache`);
    return result;
  }

  console.log(`[ProdutoCache] ${missing.length} produtos faltando no cache`);

  // FASE 3: Enriquecer produtos faltando (com limite)
  const maxEnrich = options.maxEnrich ?? parseInt(process.env.TINY_MAX_ENRICH_PER_RUN || "50", 10);
  const toEnrich = missing.slice(0, maxEnrich);
  const skipped = missing.length - toEnrich.length;

  if (skipped > 0) {
    console.log(
      `[ProdutoCache] Limite de enrichment atingido: processando ${toEnrich.length}, pulando ${skipped}`
    );
  }

  const limiter = getTinyRateLimiter();
  const enriched: ProdutoInfo[] = [];

  for (const produtoId of toEnrich) {
    try {
      // Usar rate limiter para controlar chamadas à API
      const produto = await limiter.execute(() =>
        getProdutoDetalhe(connection, Number(produtoId))
      );

      if (!produto) {
        console.warn(`[ProdutoCache] Produto ${produtoId} não encontrado na API`);
        continue;
      }

      // Extrair informações do produto (estrutura pode variar)
      const produtoData = produto as any;
      
      const info: ProdutoInfo = {
        produtoId,
        sku: produtoData.codigo || produtoData.sku || undefined,
        descricao: produtoData.nome || produtoData.descricao || `Produto ${produtoId}`,
        categoriaNome: produtoData.categoria?.descricao || produtoData.categoria?.nome || undefined,
        categoriaCaminhoCompleto: produtoData.categoria?.caminho_completo || produtoData.categoria?.caminho || undefined,
        fromCache: false,
      };

      enriched.push(info);
      result.set(produtoId, info);

      // Salvar no cache
      await prisma.tinyProdutoCache.upsert({
        where: {
          companyId_produtoId: {
            companyId,
            produtoId,
          },
        },
        create: {
          companyId,
          produtoId,
          sku: info.sku || null,
          descricao: info.descricao,
          categoriaNome: info.categoriaNome || null,
          categoriaCaminhoCompleto: info.categoriaCaminhoCompleto || null,
        },
        update: {
          sku: info.sku || null,
          descricao: info.descricao,
          categoriaNome: info.categoriaNome || null,
          categoriaCaminhoCompleto: info.categoriaCaminhoCompleto || null,
          updatedAt: new Date(),
        },
      });

      console.log(
        `[ProdutoCache] ✓ Produto ${produtoId} enriquecido e cacheado (${enriched.length}/${toEnrich.length})`
      );
    } catch (error: any) {
      console.error(
        `[ProdutoCache] ✗ Erro ao enriquecer produto ${produtoId}:`,
        error.message
      );
      
      // Adicionar produto com informação mínima (não bloquear o sync)
      result.set(produtoId, {
        produtoId,
        descricao: `Produto ${produtoId}`,
        categoriaNome: "N/D",
        categoriaCaminhoCompleto: "N/D",
        fromCache: false,
      });
    }
  }

  console.log(
    `[ProdutoCache] Enrichment concluído: ${enriched.length} produtos enriquecidos, ${skipped} pulados`
  );

  // FASE 4: Para produtos pulados, usar informação mínima
  for (const produtoId of missing.slice(toEnrich.length)) {
    result.set(produtoId, {
      produtoId,
      descricao: `Produto ${produtoId}`,
      categoriaNome: "N/D",
      categoriaCaminhoCompleto: "N/D",
      fromCache: false,
    });
  }

  return result;
}

/**
 * Limpa cache de produtos antigos (útil para manutenção)
 */
export async function cleanOldCache(companyId: string, daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.tinyProdutoCache.deleteMany({
    where: {
      companyId,
      updatedAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`[ProdutoCache] ${deleted.count} produtos antigos removidos do cache`);
  return deleted.count;
}

/**
 * Retorna estatísticas do cache
 */
export async function getCacheStats(companyId: string) {
  const total = await prisma.tinyProdutoCache.count({
    where: { companyId },
  });

  const last7Days = await prisma.tinyProdutoCache.count({
    where: {
      companyId,
      updatedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const last30Days = await prisma.tinyProdutoCache.count({
    where: {
      companyId,
      updatedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    total,
    last7Days,
    last30Days,
  };
}

/**
 * Helper simplificado: carrega cache de produtos em lote para sync por período
 * Retorna Map com informações básicas de categoria
 */
export async function loadProdutoCacheMap(
  companyId: string,
  produtoIds: number[]
): Promise<Map<number, { categoriaNome?: string; categoriaCaminhoCompleto?: string }>> {
  const result = new Map<number, { categoriaNome?: string; categoriaCaminhoCompleto?: string }>();

  if (produtoIds.length === 0) {
    return result;
  }

  // Converter number[] para BigInt[] para consulta no Prisma
  const uniqueIds = Array.from(new Set(produtoIds));
  const bigIntIds = uniqueIds.map(id => BigInt(id));

  console.log(`[ProdutoCache] Carregando cache para ${uniqueIds.length} produtos`);

  try {
    // Buscar em lote no cache
    const cached = await prisma.tinyProdutoCache.findMany({
      where: {
        companyId,
        produtoId: { in: bigIntIds },
      },
      select: {
        produtoId: true,
        categoriaNome: true,
        categoriaCaminhoCompleto: true,
      },
    });

    // Converter BigInt -> number e montar Map
    for (const item of cached) {
      const produtoIdNumber = Number(item.produtoId);
      result.set(produtoIdNumber, {
        categoriaNome: item.categoriaNome || undefined,
        categoriaCaminhoCompleto: item.categoriaCaminhoCompleto || undefined,
      });
    }

    const foundCount = result.size;
    const missingCount = uniqueIds.length - foundCount;
    const hitRate = uniqueIds.length > 0 ? ((foundCount / uniqueIds.length) * 100).toFixed(1) : '0.0';

    console.log(
      `[ProdutoCache] ✓ ${foundCount} encontrados, ${missingCount} faltando (${hitRate}% hit rate)`
    );
  } catch (error) {
    console.error('[ProdutoCache] Erro ao carregar cache:', error);
  }

  return result;
}

/**
 * Helper: extrai categoria de uma row do cache
 * Preferência: categoriaCaminhoCompleto > categoriaNome > "Pendente"
 */
export function pickCategoriaFromCache(
  row?: { categoriaNome?: string; categoriaCaminhoCompleto?: string }
): string {
  if (!row) {
    return "Pendente";
  }

  // Preferir caminho completo (mais detalhado)
  if (row.categoriaCaminhoCompleto && row.categoriaCaminhoCompleto.trim()) {
    return row.categoriaCaminhoCompleto.trim();
  }

  // Fallback para nome da categoria
  if (row.categoriaNome && row.categoriaNome.trim()) {
    return row.categoriaNome.trim();
  }

  // Se não tem nada, marcar como pendente
  return "Pendente";
}
