/**
 * Script para limpar syncs travados (RUNNING há mais de 5 minutos)
 * Uso: node scripts/clear-stuck-sync.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Procurando syncs travados...\n");

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const stuck = await prisma.syncRun.findMany({
    where: {
      status: "RUNNING",
      startedAt: {
        lt: fiveMinutesAgo,
      },
    },
  });

  if (stuck.length === 0) {
    console.log("✅ Nenhum sync travado encontrado!");
    return;
  }

  console.log(`⚠️  Encontrados ${stuck.length} sync(s) travado(s):\n`);

  stuck.forEach((s) => {
    const minutes = Math.floor((Date.now() - s.startedAt.getTime()) / 60000);
    console.log(`  - ID: ${s.id.substring(0, 8)}... | Company: ${s.companyId.substring(0, 8)}... | Rodando há: ${minutes} min`);
  });

  console.log("\n🔧 Finalizando syncs travados...");

  const result = await prisma.syncRun.updateMany({
    where: {
      status: "RUNNING",
      startedAt: {
        lt: fiveMinutesAgo,
      },
    },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage:
        "Timeout - sync travado foi finalizado automaticamente (> 5 minutos)",
    },
  });

  console.log(`✅ ${result.count} sync(s) finalizado(s) com status FAILED\n`);
  console.log("Agora você pode rodar um novo sync!");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
