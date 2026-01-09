const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function resync() {
  console.log('\n🔄 RESYNC: CONTAS A PAGAR\n');

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🗑️  PASSO 1: LIMPANDO DADOS ANTIGOS');
    console.log('═══════════════════════════════════════════════════════\n');

    // Contar registros atuais
    const countPagar = await prisma.vwContasPagar.count();
    const countPagas = await prisma.vwContasPagas.count();
    
    console.log(`📊 Registros atuais:`);
    console.log(`   vw_contas_pagar: ${countPagar}`);
    console.log(`   vw_contas_pagas: ${countPagas}`);
    console.log();

    // Deletar todos os registros
    console.log('🗑️  Deletando vw_contas_pagar...');
    const deletedPagar = await prisma.vwContasPagar.deleteMany({});
    console.log(`   ✅ ${deletedPagar.count} registros deletados\n`);

    console.log('🗑️  Deletando vw_contas_pagas...');
    const deletedPagas = await prisma.vwContasPagas.deleteMany({});
    console.log(`   ✅ ${deletedPagas.count} registros deletados\n`);

    // Limpar payloads raw (opcional)
    console.log('🗑️  Limpando payloads raw...');
    const deletedRaw = await prisma.rawPayload.deleteMany({
      where: {
        OR: [
          { module: 'vw_contas_pagar' },
          { module: 'vw_contas_pagas' }
        ]
      }
    });
    console.log(`   ✅ ${deletedRaw.count} payloads deletados\n`);

    // Resetar sync cursor
    console.log('🔄 Resetando sync cursors...');
    await prisma.syncCursor.deleteMany({
      where: {
        OR: [
          { module: 'vw_contas_pagar' },
          { module: 'vw_contas_pagas' }
        ]
      }
    });
    console.log(`   ✅ Cursors resetados\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ LIMPEZA CONCLUÍDA!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('💡 PRÓXIMOS PASSOS:\n');
    console.log('   1. Acesse o painel administrativo');
    console.log('   2. Execute uma sincronização completa');
    console.log('   3. Verifique a tab "Contas a Pagar"\n');
    console.log('🔍 Com as correções aplicadas, agora você deve ver:\n');
    console.log('   ✅ FORNECEDOR: Nome correto (de cliente.nome)');
    console.log('   ✅ CATEGORIA: Se disponível na API');
    console.log('   ✅ CENTRO CUSTO: Se disponível na API');
    console.log('   ✅ FORMA PAGTO: Se disponível na API');
    console.log('   ✅ DATA EMISSÃO: Correta (campo "data")');
    console.log('   ✅ STATUS: Mapeado de situacao\n');

    console.log('✅ SCRIPT CONCLUÍDO\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resync();
