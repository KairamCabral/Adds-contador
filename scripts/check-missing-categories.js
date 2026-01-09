/**
 * Script para diagnosticar produtos sem categoria
 * Mostra quais produtos têm categoria e quais estão como N/D
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  DIAGNÓSTICO DE CATEGORIAS - PRODUTOS                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Buscar produtos únicos com N/D
    const produtosNd = await prisma.$queryRaw`
      SELECT DISTINCT "Produto" as produto, COUNT(*) as ocorrencias
      FROM vw_vendas
      WHERE "Categoria" = 'N/D'
      GROUP BY "Produto"
      ORDER BY ocorrencias DESC
    `;

    // Buscar produtos únicos com categoria
    const produtosCat = await prisma.$queryRaw`
      SELECT DISTINCT "Produto" as produto, "Categoria" as categoria, COUNT(*) as ocorrencias
      FROM vw_vendas
      WHERE "Categoria" != 'N/D'
      GROUP BY "Produto", "Categoria"
      ORDER BY "Categoria", ocorrencias DESC
    `;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('❌ PRODUTOS SEM CATEGORIA (N/D):');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (produtosNd.length === 0) {
      console.log('   ✅ Nenhum produto sem categoria!\n');
    } else {
      produtosNd.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.produto}`);
        console.log(`      Ocorrências: ${p.ocorrencias}x\n`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ PRODUTOS COM CATEGORIA:');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (produtosCat.length === 0) {
      console.log('   ⚠️  Nenhum produto com categoria encontrado\n');
    } else {
      let currentCat = '';
      produtosCat.forEach((p) => {
        if (p.categoria !== currentCat) {
          currentCat = p.categoria;
          console.log(`\n   📂 ${currentCat}:`);
        }
        console.log(`      • ${p.produto} (${p.ocorrencias}x)`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 ESTATÍSTICAS:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const total = await prisma.vwVendas.count();
    const semCategoria = await prisma.vwVendas.count({
      where: { categoria: 'N/D' }
    });
    const comCategoria = total - semCategoria;

    const percentComCategoria = total > 0 ? ((comCategoria / total) * 100).toFixed(1) : 0;
    const percentSemCategoria = total > 0 ? ((semCategoria / total) * 100).toFixed(1) : 0;

    console.log(`   Total de registros: ${total}`);
    console.log(`   Com categoria: ${comCategoria} (${percentComCategoria}%)`);
    console.log(`   Sem categoria: ${semCategoria} (${percentSemCategoria}%)`);
    console.log('');

    console.log(`   Produtos únicos sem categoria: ${produtosNd.length}`);
    console.log(`   Produtos únicos com categoria: ${produtosCat.length}`);
    console.log('');

    if (semCategoria > 0) {
      console.log('💡 RECOMENDAÇÃO:');
      console.log('   Execute um novo sync para tentar enriquecer os produtos faltantes:');
      console.log('   → Acesse a UI e clique em "Sincronizar agora"');
      console.log('   → Ou use: POST /api/admin/sync\n');
    } else {
      console.log('✨ Todas as vendas têm categoria! Sistema funcionando perfeitamente.\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

check();
