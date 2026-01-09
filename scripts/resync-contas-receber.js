const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function resync() {
  console.log('\n🔄 LIMPEZA E RESYNC - CONTAS A RECEBER\n');

  try {
    // 1. Deletar registros antigos
    console.log('🗑️  Deletando registros antigos de vw_contas_receber_posicao...');
    const deleted = await prisma.vwContasReceberPosicao.deleteMany({});
    console.log(`   ✅ ${deleted.count} registros deletados\n`);

    // 2. Instruções para re-sync
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('1. Inicie o servidor de desenvolvimento:');
    console.log('   npm run dev\n');
    console.log('2. Acesse o sistema no navegador\n');
    console.log('3. Vá para a aba "Contas a Receber"\n');
    console.log('4. Clique em "Sincronizar agora"\n');
    console.log('5. Aguarde a sincronização completar\n');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📝 RESULTADO ESPERADO:');
    console.log('   - Cliente: ✅ nome do cliente');
    console.log('   - CNPJ: ✅ CPF/CNPJ formatado');
    console.log('   - Categoria: ✅ nome da categoria (se vinculada) OU "N/D" (se não vinculada)');
    console.log('   - Centro Custo: "-" ou vazio (não disponível na API Tiny)');
    console.log('   - Datas e valores: ✅ corretos\n');
    console.log('📄 Documentação completa em: docs/CONTAS_RECEBER_LIMITACOES.md\n');

    console.log('✅ LIMPEZA CONCLUÍDA\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resync();
