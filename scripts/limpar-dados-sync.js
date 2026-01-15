/**
 * Script para limpar dados sincronizados do banco
 * 
 * USO:
 *   node scripts/limpar-dados-sync.js
 * 
 * ⚠️ ATENÇÃO: Isso irá apagar TODOS os dados sincronizados!
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function limparDadosSync() {
  console.log("🗑️  Iniciando limpeza do banco de dados...\n");

  try {
    // Contar registros antes
    console.log("📊 Registros antes da limpeza:");
    const countBefore = {
      vendas: await prisma.vwVendas.count(),
      contasReceber: await prisma.vwContasReceberPosicao.count(),
      contasPagar: await prisma.vwContasPagar.count(),
      contasPagas: await prisma.vwContasPagas.count(),
      contasRecebidas: await prisma.vwContasRecebidas.count(),
      estoque: await prisma.vwEstoque.count(),
      produtoCache: await prisma.tinyProdutoCache.count(),
      syncRuns: await prisma.syncRun.count(),
    };

    console.table(countBefore);

    // Executar limpeza
    console.log("\n🧹 Limpando dados...");

    // 1. Limpar views de relatórios (ordem importa por causa de foreign keys)
    console.log("  → Limpando VwVendas...");
    await prisma.vwVendas.deleteMany();

    console.log("  → Limpando VwContasReceberPosicao...");
    await prisma.vwContasReceberPosicao.deleteMany();

    console.log("  → Limpando VwContasPagar...");
    await prisma.vwContasPagar.deleteMany();

    console.log("  → Limpando VwContasPagas...");
    await prisma.vwContasPagas.deleteMany();

    console.log("  → Limpando VwContasRecebidas...");
    await prisma.vwContasRecebidas.deleteMany();

    console.log("  → Limpando VwEstoque...");
    await prisma.vwEstoque.deleteMany();

    // 2. Limpar cache de produtos
    console.log("  → Limpando TinyProdutoCache...");
    await prisma.tinyProdutoCache.deleteMany();

    // 3. Limpar histórico de sincronizações
    console.log("  → Limpando SyncRun...");
    await prisma.syncRun.deleteMany();

    // Contar registros depois
    console.log("\n📊 Registros após limpeza:");
    const countAfter = {
      vendas: await prisma.vwVendas.count(),
      contasReceber: await prisma.vwContasReceberPosicao.count(),
      contasPagar: await prisma.vwContasPagar.count(),
      contasPagas: await prisma.vwContasPagas.count(),
      contasRecebidas: await prisma.vwContasRecebidas.count(),
      estoque: await prisma.vwEstoque.count(),
      produtoCache: await prisma.tinyProdutoCache.count(),
      syncRuns: await prisma.syncRun.count(),
    };

    console.table(countAfter);

    // Verificar configurações mantidas
    console.log("\n✅ Configurações mantidas:");
    const maintained = {
      usuários: await prisma.user.count(),
      empresas: await prisma.company.count(),
      conexõesTiny: await prisma.tinyConnection.count(),
    };

    console.table(maintained);

    console.log("\n✅ Limpeza concluída com sucesso!");
    console.log("\n💡 Próximos passos:");
    console.log("   1. Acesse a aplicação");
    console.log("   2. Clique no botão 'Sincronizar' no header");
    console.log("   3. Escolha 'Por Mês' e selecione o período desejado");
    console.log("   4. Aguarde a sincronização completar");

  } catch (error) {
    console.error("\n❌ Erro ao limpar banco:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
limparDadosSync()
  .then(() => {
    console.log("\n🎯 Processo finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Falha:", error);
    process.exit(1);
  });
