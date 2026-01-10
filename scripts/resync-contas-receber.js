const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function resync() {
  console.log('\n');
  console.log('🔄 RESYNC: CONTAS A RECEBER');
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🗑️  PASSO 1: LIMPANDO DADOS ANTIGOS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  try {
    // Buscar empresa
    const company = await prisma.company.findFirst();
    if (!company) {
      console.error('❌ Nenhuma empresa encontrada no banco');
      process.exit(1);
    }

    // 1. Contar registros atuais
    const countPosicao = await prisma.vwContasReceberPosicao.count({ where: { companyId: company.id } });
    const countRecebidas = await prisma.vwContasRecebidas.count({ where: { companyId: company.id } });

    console.log('📊 Registros atuais:');
    console.log(`   vw_contas_receber_posicao: ${countPosicao}`);
    console.log(`   vw_contas_recebidas: ${countRecebidas}\n`);

    // 2. Deletar vw_contas_receber_posicao
    console.log('🗑️  Deletando vw_contas_receber_posicao...');
    const deletedPosicao = await prisma.vwContasReceberPosicao.deleteMany({
      where: { companyId: company.id }
    });
    console.log(`   ✅ ${deletedPosicao.count} registros deletados\n`);

    // 3. Deletar vw_contas_recebidas
    console.log('🗑️  Deletando vw_contas_recebidas...');
    const deletedRecebidas = await prisma.vwContasRecebidas.deleteMany({
      where: { companyId: company.id }
    });
    console.log(`   ✅ ${deletedRecebidas.count} registros deletados\n`);

    // 4. Limpar payloads raw (contas a receber)
    console.log('🗑️  Limpando payloads raw...');
    const deletedPayloads = await prisma.rawPayload.deleteMany({
      where: {
        companyId: company.id,
        module: { in: ['vw_contas_receber_posicao', 'vw_contas_recebidas'] }
      }
    });
    console.log(`   ✅ ${deletedPayloads.count} payloads deletados\n`);

    // 5. Resetar cursores de sincronização
    console.log('🔄 Resetando sync cursors...');
    await prisma.syncCursor.deleteMany({
      where: {
        companyId: company.id,
        module: { in: ['vw_contas_receber_posicao', 'vw_contas_recebidas'] }
      }
    });
    console.log('   ✅ Cursors resetados\n');

    // Instruções
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('✅ LIMPEZA CONCLUÍDA!');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    console.log('💡 PRÓXIMOS PASSOS:\n');
    console.log('   1. Acesse o painel administrativo');
    console.log('   2. Execute uma sincronização completa');
    console.log('   3. Verifique a tab "Contas Recebidas"\n');

    console.log('🔍 Com as correções aplicadas, agora você deve ver:\n');
    console.log('   ✅ CLIENTE: Nome correto');
    console.log('   ✅ CNPJ/CPF: Documento correto');
    console.log('   ✅ CATEGORIA: Categoria da API (quando disponível) ou "N/D"');
    console.log('   ⚠️  CENTRO CUSTO: Sempre vazio (limitação da API Tiny)');
    console.log('   ✅ FORMA RECEBIMENTO: Extraída corretamente do detalhe');
    console.log('   ✅ CONTA BANCÁRIA: Extraída corretamente do detalhe');
    console.log('   ✅ DATAS e VALORES: Todos corretos\n');

    console.log('📄 Detalhes técnicos:');
    console.log('   - Enrichment implementado (busca detalhe individual)');
    console.log('   - Delay progressivo para evitar rate limit');
    console.log('   - Extração robusta de objetos da API\n');

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
