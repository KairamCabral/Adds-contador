/**
 * Script para limpar dados antigos e preparar para novo sync
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanAndResync() {
  console.log("🧹 Limpando dados antigos...\n");

  // Contar registros antes
  const before = {
    vendas: await prisma.vwVendas.count(),
    contasReceber: await prisma.vwContasReceberPosicao.count(),
    contasPagar: await prisma.vwContasPagar.count(),
  };

  console.log("Registros antes:");
  console.log(`  - vw_vendas: ${before.vendas}`);
  console.log(`  - vw_contas_receber_posicao: ${before.contasReceber}`);
  console.log(`  - vw_contas_pagar: ${before.contasPagar}`);
  console.log("");

  // Limpar tabelas
  await prisma.vwVendas.deleteMany({});
  await prisma.vwContasReceberPosicao.deleteMany({});
  await prisma.vwContasPagar.deleteMany({});
  await prisma.vwContasPagas.deleteMany({});
  await prisma.vwContasRecebidas.deleteMany({});

  console.log("✅ Dados limpos!");
  console.log("");
  console.log("📝 Próximo passo:");
  console.log("   1. Recarregue a página no navegador");
  console.log("   2. Clique em 'Sincronizar agora'");
  console.log("   3. Aguarde o sync terminar");
  console.log("   4. Recarregue a página");
  console.log("   5. TODOS os dados devem estar corretos agora!");
}

cleanAndResync()
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

