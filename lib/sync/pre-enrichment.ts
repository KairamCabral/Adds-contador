/**
 * Pre-enrichment de produtos antes de sync de período
 * 
 * Se poucos produtos estão faltando no cache (≤ 20), enriquece rapidamente
 * antes de iniciar o sync, garantindo 100% de categorias preenchidas.
 * 
 * Se muitos produtos faltando, NÃO bloqueia - deixa para o job diário.
 */

import { prisma } from "@/lib/db";
import { TinyConnection } from "@prisma/client";
import { getProdutosInfo } from "@/lib/tiny/produto-cache";
import { getCachedProdutosOnly } from "@/lib/tiny/produto-cache-readonly";

const MAX_PRE_ENRICH = 20; // Máximo de produtos a enriquecer antes do sync
const MAX_WAIT_TIME_MS = 90000; // 90 segundos máximo

export interface PreEnrichmentResult {
  shouldProceed: boolean;
  totalProducts: number;
  cached: number;
  missing: number;
  enriched: number;
  timeMs: number;
  message: string;
}

/**
 * Verifica produtos do período e enriquece se necessário
 */
export async function preEnrichPeriodProducts(
  companyId: string,
  connection: TinyConnection,
  startDate: Date,
  endDate: Date
): Promise<PreEnrichmentResult> {
  const startTime = Date.now();

  console.log(
    `[PreEnrich] Verificando produtos do período ${startDate.toISOString().split("T")[0]} a ${endDate.toISOString().split("T")[0]}`
  );

  try {
    // FASE 1: Buscar produtos únicos do período
    const productsInPeriod = await prisma.$queryRaw<{ produto_id: bigint }[]>`
      SELECT DISTINCT 
        CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT) as produto_id
      FROM vw_vendas
      WHERE "companyId" = ${companyId}
        AND "DataHora" >= ${startDate}
        AND "DataHora" <= ${endDate}
        AND "Produto" LIKE '%ID:%'
        AND CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT) IS NOT NULL
    `;

    const produtoIds = productsInPeriod.map((p) => p.produto_id);

    if (produtoIds.length === 0) {
      console.log(`[PreEnrich] Nenhum produto no período`);
      return {
        shouldProceed: true,
        totalProducts: 0,
        cached: 0,
        missing: 0,
        enriched: 0,
        timeMs: Date.now() - startTime,
        message: "Nenhum produto no período",
      };
    }

    console.log(`[PreEnrich] ${produtoIds.length} produtos únicos no período`);

    // FASE 2: Verificar cache
    const { cached, missing } = await getCachedProdutosOnly(companyId, produtoIds);

    const cacheHitRate = ((cached.size / produtoIds.length) * 100).toFixed(1);
    console.log(
      `[PreEnrich] Cache: ${cached.size}/${produtoIds.length} (${cacheHitRate}% hit rate)`
    );

    // Se poucos produtos faltando, enriquecer
    if (missing.length > 0 && missing.length <= MAX_PRE_ENRICH) {
      console.log(
        `[PreEnrich] ⚡ ${missing.length} produtos faltando (≤${MAX_PRE_ENRICH}): enriquecendo antes do sync...`
      );

      const enrichStartTime = Date.now();

      // Enriquecer com timeout
      const enrichPromise = getProdutosInfo(companyId, connection, missing, {
        maxEnrich: MAX_PRE_ENRICH,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), MAX_WAIT_TIME_MS)
      );

      try {
        const produtosMap = await Promise.race([enrichPromise, timeoutPromise]) as Awaited<
          ReturnType<typeof getProdutosInfo>
        >;

        const enriched = Array.from(produtosMap.values()).filter((p) => !p.fromCache)
          .length;

        const enrichTimeMs = Date.now() - enrichStartTime;

        console.log(
          `[PreEnrich] ✓ ${enriched} produtos enriquecidos em ${enrichTimeMs}ms`
        );

        return {
          shouldProceed: true,
          totalProducts: produtoIds.length,
          cached: cached.size,
          missing: missing.length,
          enriched,
          timeMs: Date.now() - startTime,
          message: `Pre-enrichment concluído: ${enriched} produtos enriquecidos`,
        };
      } catch {
        console.warn(`[PreEnrich] Timeout ou erro no enrichment, continuando...`);
        // Continuar mesmo com erro
      }
    } else if (missing.length > MAX_PRE_ENRICH) {
      console.log(
        `[PreEnrich] ⏭️  ${missing.length} produtos faltando (>${MAX_PRE_ENRICH}): NÃO enriquecendo (deixar para job diário)`
      );
    }

    return {
      shouldProceed: true,
      totalProducts: produtoIds.length,
      cached: cached.size,
      missing: missing.length,
      enriched: 0,
      timeMs: Date.now() - startTime,
      message:
        missing.length > MAX_PRE_ENRICH
          ? `Muitos produtos faltando (${missing.length}), deixando para job diário`
          : `Cache suficiente (${cacheHitRate}% hit rate)`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[PreEnrich] Erro:`, errorMessage);
    // Continuar mesmo com erro
    return {
      shouldProceed: true,
      totalProducts: 0,
      cached: 0,
      missing: 0,
      enriched: 0,
      timeMs: Date.now() - startTime,
      message: `Erro no pre-enrichment: ${errorMessage}`,
    };
  }
}

/**
 * Verifica se vale a pena fazer pre-enrichment
 * (baseado em dados históricos)
 */
export async function shouldPreEnrich(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  try {
    // Estimar quantos produtos terão no período
    // (baseado em média de vendas por dia * dias do período)
    const daysInPeriod = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysInPeriod > 45) {
      // Períodos muito longos: não fazer pre-enrichment
      return false;
    }

    // Buscar amostra de 7 dias antes do período
    const sampleStart = new Date(startDate);
    sampleStart.setDate(sampleStart.getDate() - 7);

    const sampleProducts = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT)) as count
      FROM vw_vendas
      WHERE "companyId" = ${companyId}
        AND "DataHora" >= ${sampleStart}
        AND "DataHora" < ${startDate}
        AND "Produto" LIKE '%ID:%'
    `;

    const avgProductsPerWeek = Number(sampleProducts[0]?.count || 0);
    const estimatedProducts = Math.ceil((avgProductsPerWeek / 7) * daysInPeriod);

    console.log(
      `[PreEnrich] Estimativa: ~${estimatedProducts} produtos no período (baseado em amostra)`
    );

    // Se estimar poucos produtos, vale a pena fazer pre-enrichment
    return estimatedProducts <= MAX_PRE_ENRICH * 2;
  } catch (error) {
    console.error(`[PreEnrich] Erro ao estimar produtos:`, error);
    return false; // Em caso de erro, não fazer pre-enrichment
  }
}
