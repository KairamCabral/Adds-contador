/**
 * Serviço de consulta de cache de produtos (READONLY - sem enriquecer)
 * 
 * Usado em sync de período para garantir ZERO chamadas à API do Tiny.
 */

import { prisma } from "@/lib/db";

export interface CachedProdutoInfo {
  produtoId: bigint;
  sku?: string;
  descricao: string;
  categoriaNome?: string;
  categoriaCaminhoCompleto?: string;
}

/**
 * Busca produtos SOMENTE do cache (sem enriquecer)
 * Produtos não encontrados retornam com categoria "Pendente"
 */
export async function getCachedProdutosOnly(
  companyId: string,
  produtoIds: bigint[]
): Promise<{
  cached: Map<bigint, CachedProdutoInfo>;
  missing: bigint[];
}> {
  if (produtoIds.length === 0) {
    return { cached: new Map(), missing: [] };
  }

  const uniqueIds = Array.from(new Set(produtoIds.map(id => id.toString()))).map(id => BigInt(id));
  
  console.log(`[ProdutoCache-RO] Consultando ${uniqueIds.length} produtos no cache`);

  // Consultar cache em lote
  const cachedRecords = await prisma.tinyProdutoCache.findMany({
    where: {
      companyId,
      produtoId: { in: uniqueIds },
    },
  });

  console.log(`[ProdutoCache-RO] ${cachedRecords.length} produtos encontrados no cache`);

  // Mapear produtos cacheados
  const cached = new Map<bigint, CachedProdutoInfo>();
  const cachedIds = new Set<string>();

  for (const record of cachedRecords) {
    cachedIds.add(record.produtoId.toString());
    cached.set(record.produtoId, {
      produtoId: record.produtoId,
      sku: record.sku || undefined,
      descricao: record.descricao,
      categoriaNome: record.categoriaNome || undefined,
      categoriaCaminhoCompleto: record.categoriaCaminhoCompleto || undefined,
    });
  }

  // Identificar produtos faltando
  const missing = uniqueIds.filter(id => !cachedIds.has(id.toString()));

  if (missing.length > 0) {
    console.warn(
      `[ProdutoCache-RO] ⚠️  ${missing.length} produtos NÃO encontrados no cache (marcarão como "Pendente")`
    );
  }

  return { cached, missing };
}

/**
 * Registra produtos pendentes para enriquecimento posterior
 * (usado para alimentar o job de prewarm)
 */
export async function registerPendingProducts(
  companyId: string,
  produtoIds: bigint[]
) {
  if (produtoIds.length === 0) return;

  // Criar registros "stub" para produtos pendentes
  // Isso permite rastreá-los para enriquecimento futuro
  const stubs = produtoIds.map(produtoId => ({
    companyId,
    produtoId,
    descricao: `Produto ${produtoId}`,
    // Campos nulos indicam que precisa ser enriquecido
    categoriaNome: null,
    categoriaCaminhoCompleto: null,
  }));

  // Upsert em lote (ignora se já existe)
  for (const stub of stubs) {
    try {
      await prisma.tinyProdutoCache.upsert({
        where: {
          companyId_produtoId: {
            companyId: stub.companyId,
            produtoId: stub.produtoId,
          },
        },
        create: stub,
        update: {}, // Não atualizar se já existe
      });
    } catch (err) {
      // Ignorar erros (pode ser conflito de concorrência)
    }
  }

  console.log(
    `[ProdutoCache-RO] ${produtoIds.length} produtos pendentes registrados para enriquecimento futuro`
  );
}

/**
 * Busca produtos que precisam ser enriquecidos
 * (categoria null ou desatualizado)
 */
export async function getPendingProductsForEnrichment(
  companyId: string,
  daysOld = 30,
  limit = 100
): Promise<bigint[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // Buscar produtos sem categoria ou desatualizados
  const pending = await prisma.tinyProdutoCache.findMany({
    where: {
      companyId,
      OR: [
        { categoriaNome: null },
        { updatedAt: { lt: cutoffDate } },
      ],
    },
    select: { produtoId: true },
    take: limit,
    orderBy: { createdAt: 'desc' }, // Mais recentes primeiro
  });

  return pending.map(p => p.produtoId);
}
