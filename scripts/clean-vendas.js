/**
 * Script para limpar dados problemáticos de vw_vendas
 * Execute: node scripts/clean-vendas.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Iniciando limpeza de vw_vendas...\n');

  try {
    // Estatísticas ANTES
    console.log('📊 ESTATÍSTICAS ANTES DA LIMPEZA:');
    const totalAntes = await prisma.vwVendas.count();
    const comUndefined = await prisma.vwVendas.count({
      where: {
        produto: {
          contains: 'undefined'
        }
      }
    });
    console.log(`   Total de registros: ${totalAntes}`);
    console.log(`   Com "undefined": ${comUndefined}\n`);

    // Deletar registros com "Pedido #undefined"
    console.log('🗑️  Deletando registros com "undefined"...');
    const deleted = await prisma.vwVendas.deleteMany({
      where: {
        produto: {
          contains: 'undefined'
        }
      }
    });
    console.log(`   ✅ ${deleted.count} registros deletados\n`);

    // Opcional: Deletar TUDO (descomente se quiser)
    // console.log('🗑️  Deletando TODOS os registros...');
    // const deletedAll = await prisma.vwVendas.deleteMany({});
    // console.log(`   ✅ ${deletedAll.count} registros deletados\n`);

    // Estatísticas DEPOIS
    console.log('📊 ESTATÍSTICAS DEPOIS DA LIMPEZA:');
    const totalDepois = await prisma.vwVendas.count();
    const comUndefinedDepois = await prisma.vwVendas.count({
      where: {
        produto: {
          contains: 'undefined'
        }
      }
    });
    console.log(`   Total de registros: ${totalDepois}`);
    console.log(`   Com "undefined": ${comUndefinedDepois}\n`);

    console.log('✨ Limpeza concluída com sucesso!');
    console.log('\n📌 PRÓXIMOS PASSOS:');
    console.log('   1. Acesse http://localhost:3000/relatorios/vw_vendas');
    console.log('   2. Clique em "Sincronizar agora"');
    console.log('   3. Aguarde o sync completar');
    console.log('   4. Valide os dados na tabela\n');

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
