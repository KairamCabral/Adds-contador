/**
 * Endpoint para enriquecer produtos em background
 * 
 * Busca produtos sem cache e enriquece aos poucos, respeitando rate limit.
 * Ideal para rodar em cron diário (madrugada) ou manualmente.
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

    console.log(`[EnrichProdutos] Processando ${companies.length} empresas`);

    const results = [];

    for (const company of companies) {
      const connection = company.connections[0];
      if (!connection) continue;

      try {
        console.log(`[EnrichProdutos] Empresa ${company.name} (${company.id})`);

        // Buscar produtos únicos das vendas que ainda não estão no cache
        const produtosVendas = await prisma.$queryRaw<{ produto_id: bigint }[]>`
          SELECT DISTINCT 
            CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT) as produto_id
          FROM vw_vendas
          WHERE "companyId" = ${company.id}
            AND "Produto" LIKE '%ID:%'
            AND CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT) IS NOT NULL
            AND CAST(SUBSTRING("Produto" FROM 'ID:([0-9]+)') AS BIGINT) NOT IN (
              SELECT produto_id 
              FROM tiny_produto_cache 
              WHERE "companyId" = ${company.id}
            )
          LIMIT 100
        `;

        if (produtosVendas.length === 0) {
          console.log(`[EnrichProdutos] Empresa ${company.name}: todos os produtos já cacheados`);
          results.push({
            companyId: company.id,
            companyName: company.name,
            enriched: 0,
            message: "Todos os produtos já cacheados",
          });
          continue;
        }

        const produtoIds = produtosVendas.map((p) => p.produto_id);
        console.log(
          `[EnrichProdutos] Empresa ${company.name}: ${produtoIds.length} produtos sem cache`
        );

        // Enriquecer produtos (com limite de 30 por empresa para não estourar timeout)
        const produtosMap = await getProdutosInfo(
          company.id,
          connection,
          produtoIds,
          {
            maxEnrich: 30, // Limite conservador para background job
          }
        );

        const enriched = Array.from(produtosMap.values()).filter((p) => !p.fromCache).length;

        console.log(
          `[EnrichProdutos] Empresa ${company.name}: ${enriched} produtos enriquecidos`
        );

        results.push({
          companyId: company.id,
          companyName: company.name,
          enriched,
          total: produtoIds.length,
        });

        // Pequeno delay entre empresas
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        console.error(`[EnrichProdutos] Erro na empresa ${company.name}:`, errorMessage);
        results.push({
          companyId: company.id,
          companyName: company.name,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Enrichment em background concluído",
      results,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[EnrichProdutos] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao enriquecer produtos",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
