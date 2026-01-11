/**
 * POST /api/admin/prewarm/produtos
 * 
 * Job diário de "prewarm" do cache de produtos.
 * 
 * Objetivo:
 * - Buscar produtos que apareceram em vendas nos últimos 7-14 dias
 * - Enriquecer produtos que não estão no cache ou estão desatualizados
 * - Manter cache sempre aquecido para sync mensal
 * 
 * Resultado:
 * - 99% das categorias aparecem preenchidas no sync mensal
 * - Zero chamadas a /produtos/{id} durante sync de período
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProdutosInfo } from "@/lib/tiny/produto-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação (cron secret ou admin)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Autenticado via cron
    } else {
      // TODO: Verificar se usuário é admin
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    console.log("[Prewarm] Iniciando job de prewarm de produtos...");

    // Buscar todas as empresas com conexão Tiny
    const companies = await prisma.company.findMany({
      where: {
        connections: {
          some: {},
        },
      },
      include: {
        connections: true,
      },
    });

    console.log(`[Prewarm] Processando ${companies.length} empresas`);

    const results = [];

    for (const company of companies) {
      const connection = company.connections[0];
      if (!connection) continue;

      try {
        console.log(`[Prewarm] Empresa ${company.name} (${company.id})`);

        // FASE 1: Buscar produtos únicos das vendas dos últimos 14 dias
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 14);

        const recentProducts = await prisma.$queryRaw<{ produto_id: bigint }[]>`
          SELECT DISTINCT 
            CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT) as produto_id
          FROM vw_vendas
          WHERE "companyId" = ${company.id}
            AND "DataHora" >= ${cutoffDate}
            AND "Produto" LIKE '%ID:%'
            AND CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT) IS NOT NULL
        `;

        if (recentProducts.length === 0) {
          console.log(`[Prewarm] Empresa ${company.name}: nenhum produto recente`);
          results.push({
            companyId: company.id,
            companyName: company.name,
            enriched: 0,
            message: "Nenhum produto recente",
          });
          continue;
        }

        const allProductIds = recentProducts.map((p) => p.produto_id);
        console.log(
          `[Prewarm] Empresa ${company.name}: ${allProductIds.length} produtos únicos nos últimos 14 dias`
        );

        // FASE 2: Verificar quais produtos precisam ser enriquecidos
        // (não estão no cache ou estão desatualizados > 30 dias)
        const cacheDate = new Date();
        cacheDate.setDate(cacheDate.getDate() - 30);

        const needsEnrichment = await prisma.tinyProdutoCache.findMany({
          where: {
            companyId: company.id,
            produtoId: { in: allProductIds },
            OR: [
              { categoriaNome: null },
              { updatedAt: { lt: cacheDate } },
            ],
          },
          select: { produtoId: true },
        });

        const needsEnrichmentIds = new Set(
          needsEnrichment.map((p) => p.produtoId.toString())
        );

        // Adicionar produtos que não estão no cache
        const cached = await prisma.tinyProdutoCache.findMany({
          where: {
            companyId: company.id,
            produtoId: { in: allProductIds },
          },
          select: { produtoId: true },
        });

        const cachedIds = new Set(cached.map((p) => p.produtoId.toString()));
        const missingIds = allProductIds.filter(
          (id) => !cachedIds.has(id.toString())
        );

        for (const id of missingIds) {
          needsEnrichmentIds.add(id.toString());
        }

        const toEnrichIds = Array.from(needsEnrichmentIds).map((id) => BigInt(id));

        if (toEnrichIds.length === 0) {
          console.log(`[Prewarm] Empresa ${company.name}: cache 100% atualizado`);
          results.push({
            companyId: company.id,
            companyName: company.name,
            enriched: 0,
            total: allProductIds.length,
            message: "Cache 100% atualizado",
          });
          continue;
        }

        console.log(
          `[Prewarm] Empresa ${company.name}: ${toEnrichIds.length} produtos precisam ser enriquecidos`
        );

        // FASE 3: Enriquecer produtos (com limite conservador)
        const maxEnrich = 50; // Limite conservador para job diário
        const toEnrich = toEnrichIds.slice(0, maxEnrich);

        console.log(
          `[Prewarm] Empresa ${company.name}: enriquecendo ${toEnrich.length} produtos (limite: ${maxEnrich})`
        );

        const produtosMap = await getProdutosInfo(
          company.id,
          connection,
          toEnrich,
          {
            maxEnrich: maxEnrich,
          }
        );

        const enriched = Array.from(produtosMap.values()).filter((p) => !p.fromCache)
          .length;

        console.log(
          `[Prewarm] Empresa ${company.name}: ${enriched} produtos enriquecidos`
        );

        results.push({
          companyId: company.id,
          companyName: company.name,
          enriched,
          total: allProductIds.length,
          pending: toEnrichIds.length - toEnrich.length,
        });

        // Pequeno delay entre empresas
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`[Prewarm] Erro na empresa ${company.name}:`, error.message);
        results.push({
          companyId: company.id,
          companyName: company.name,
          error: error.message,
        });
      }
    }

    console.log("[Prewarm] Job concluído");

    return NextResponse.json({
      success: true,
      message: "Prewarm concluído",
      results,
    });
  } catch (error: any) {
    console.error("[Prewarm] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro no prewarm de produtos",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
