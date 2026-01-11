import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProdutoDetalhe } from "@/lib/tiny/api";
import { getTinyRateLimiter } from "@/lib/tiny/rate-limiter";

/**
 * Cron de prewarm: aquece cache de produtos mais usados
 * 
 * Estratégia:
 * - Busca produtos vendidos nos últimos 14 dias
 * - Filtra os que não estão no cache ou estão expirados (> 30 dias)
 * - Enriquece no máximo 50 produtos por execução
 * - Rate limit: 1 req/seg, retry em 429
 * 
 * Resultado esperado:
 * - Cache 99%+ aquecido após alguns dias
 * - Zero chamadas /produtos/{id} no sync manual
 */

// Autenticação via CRON_SECRET
function isCronRequest(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verificar autenticação
  if (!isCronRequest(request)) {
    console.error("[Prewarm] Acesso negado: CRON_SECRET inválido");
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  console.log("[Prewarm] 🔥 Iniciando prewarm de produtos...");

  try {
    // 1. Buscar todas as empresas com conexão Tiny
    const companies = await prisma.company.findMany({
      include: {
        connections: {
          take: 1,
        },
      },
    });

    let totalEnriched = 0;
    let totalSkipped = 0;

    for (const company of companies) {
      const connection = company.connections[0];
      if (!connection) {
        console.log(`[Prewarm] ${company.name}: sem conexão Tiny, pulando`);
        continue;
      }

      console.log(`[Prewarm] Processando ${company.name}...`);

      // 2. Identificar produtos mais usados nos últimos 14 dias
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const recentProducts = await prisma.vwVendas.groupBy({
        by: ['produtoId'],
        where: {
          companyId: company.id,
          dataHora: {
            gte: fourteenDaysAgo,
          },
        },
        _count: {
          produtoId: true,
        },
        orderBy: {
          _count: {
            produtoId: 'desc',
          },
        },
        take: 200, // Top 200 produtos mais vendidos
      });

      if (recentProducts.length === 0) {
        console.log(`[Prewarm] ${company.name}: nenhum produto vendido nos últimos 14 dias`);
        continue;
      }

      const produtoIds = recentProducts
        .map(p => p.produtoId)
        .filter((id): id is bigint => id !== null);

      console.log(`[Prewarm] ${company.name}: ${produtoIds.length} produtos vendidos recentemente`);

      // 3. Verificar quais NÃO estão no cache ou estão expirados (> 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const cachedProducts = await prisma.tinyProdutoCache.findMany({
        where: {
          companyId: company.id,
          produtoId: {
            in: produtoIds,
          },
          updatedAt: {
            gte: thirtyDaysAgo, // Apenas os atualizados recentemente
          },
        },
        select: {
          produtoId: true,
        },
      });

      const cachedIds = new Set(cachedProducts.map(p => p.produtoId.toString()));
      const missingIds = produtoIds.filter(id => !cachedIds.has(id.toString()));

      console.log(
        `[Prewarm] ${company.name}: ${cachedIds.size} em cache válido, ${missingIds.length} faltando/expirados`
      );

      if (missingIds.length === 0) {
        console.log(`[Prewarm] ${company.name}: cache já está quente ✓`);
        totalSkipped += produtoIds.length;
        continue;
      }

      // 4. Limitar a 50 produtos por empresa para não estourar rate limit
      const MAX_ENRICH_PER_COMPANY = 50;
      const toEnrich = missingIds.slice(0, MAX_ENRICH_PER_COMPANY);

      console.log(
        `[Prewarm] ${company.name}: enriquecendo ${toEnrich.length} produtos (limite: ${MAX_ENRICH_PER_COMPANY})`
      );

      // 5. Enriquecer com rate limiter
      const rateLimiter = getTinyRateLimiter();
      let enriched = 0;
      let errors = 0;

      for (const produtoId of toEnrich) {
        try {
          // Rate limiter garante 1 req/seg e retry em 429
          const produto = await rateLimiter.execute(
            () => getProdutoDetalhe(connection, Number(produtoId)),
            `produto-${produtoId}`
          );

          // Extrair categoria
          const categoriaNome = produto.categoria?.descricao || null;
          const categoriaCaminhoCompleto = produto.categoria?.caminho_completo || 
                                          produto.categoria?.descricao || 
                                          null;

          // Salvar no cache
          await prisma.tinyProdutoCache.upsert({
            where: {
              companyId_produtoId: {
                companyId: company.id,
                produtoId: produtoId,
              },
            },
            create: {
              companyId: company.id,
              produtoId: produtoId,
              sku: produto.codigo || null,
              descricao: produto.nome || `Produto ${produtoId}`,
              categoriaNome,
              categoriaCaminhoCompleto,
            },
            update: {
              sku: produto.codigo || null,
              descricao: produto.nome || `Produto ${produtoId}`,
              categoriaNome,
              categoriaCaminhoCompleto,
              updatedAt: new Date(),
            },
          });

          enriched++;

          if (enriched % 10 === 0) {
            console.log(`[Prewarm] ${company.name}: ${enriched}/${toEnrich.length} enriquecidos...`);
          }
        } catch (err) {
          errors++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.warn(`[Prewarm] Erro ao enriquecer produto ${produtoId}: ${errorMsg.substring(0, 100)}`);
          
          // Se tiver muitos erros, parar
          if (errors >= 5) {
            console.error(`[Prewarm] ${company.name}: muitos erros (${errors}), abortando`);
            break;
          }
        }
      }

      totalEnriched += enriched;
      console.log(
        `[Prewarm] ${company.name}: ✓ ${enriched} produtos enriquecidos, ${errors} erros`
      );
    }

    const durationMs = Date.now() - startTime;
    const durationMin = Math.floor(durationMs / 60000);
    const durationSec = Math.floor((durationMs % 60000) / 1000);

    console.log(
      `[Prewarm] 🎉 Concluído em ${durationMin}m ${durationSec}s. Total: ${totalEnriched} enriquecidos, ${totalSkipped} já em cache`
    );

    return NextResponse.json({
      success: true,
      totalCompanies: companies.length,
      totalEnriched,
      totalSkipped,
      durationMs,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro no prewarm";
    const durationMs = Date.now() - startTime;

    console.error("[Prewarm] ❌ Erro:", errorMessage);
    console.error("[Prewarm] Stack:", error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        durationMs,
      },
      { status: 500 }
    );
  }
}
