/**
 * scripts/resync-contas-pagas.js
 * Limpa e resincroniza contas pagas para testar correções
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resync() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🔄 RESYNC: Contas Pagas                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      console.error('❌ Nenhuma empresa encontrada');
      return;
    }

    console.log(`📋 Empresa: ${company.name} (${company.id})\n`);

    // ETAPA 1: Limpar dados existentes
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🗑️  ETAPA 1: LIMPEZA');
    console.log('═══════════════════════════════════════════════════════════\n');

    const deletedPagas = await prisma.vwContasPagas.deleteMany({
      where: { companyId: company.id }
    });
    console.log(`   ✅ Removidas ${deletedPagas.count} contas pagas`);

    const deletedPayloads = await prisma.rawPayload.deleteMany({
      where: { 
        companyId: company.id,
        module: 'vw_contas_pagas'
      }
    });
    console.log(`   ✅ Removidos ${deletedPayloads.count} raw payloads`);

    // ETAPA 2: Resetar cursor
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔄 ETAPA 2: RESET CURSOR');
    console.log('═══════════════════════════════════════════════════════════\n');

    await prisma.syncCursor.deleteMany({
      where: {
        companyId: company.id,
        module: 'vw_contas_pagas'
      }
    });
    console.log('   ✅ Cursor resetado');

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ LIMPEZA CONCLUÍDA                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('🎯 Próximo passo:');
    console.log('   Execute: npm run dev');
    console.log('   Acesse: http://localhost:3000');
    console.log('   Clique em "Sincronizar Agora" para testar as correções\n');

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

resync().catch(console.error);
