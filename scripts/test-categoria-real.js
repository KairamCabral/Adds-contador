/**
 * Script para testar categoria em tempo real
 * Execute: node scripts/test-categoria-real.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 TESTANDO CATEGORIA EM TEMPO REAL\n');

  try {
    // Buscar TinyConnection
    const connection = await prisma.tinyConnection.findFirst({
      where: { isActive: true },
    });

    if (!connection) {
      console.log('❌ Nenhuma TinyConnection ativa encontrada');
      return;
    }

    console.log('✅ TinyConnection encontrada\n');

    // Buscar uma venda recente
    const venda = await prisma.vwVendas.findFirst({
      where: {
        produto: {
          not: {
            contains: 'Pedido #'
          }
        }
      },
      orderBy: { dataHora: 'desc' },
    });

    if (!venda) {
      console.log('❌ Nenhuma venda encontrada');
      return;
    }

    console.log('📦 Venda selecionada:');
    console.log(`   Produto: ${venda.produto}`);
    console.log(`   Categoria atual: ${venda.categoria}`);
    console.log(`   ID: ${venda.id}\n`);

    // Extrair pedidoId do ID (formato: companyId:pedidoId)
    const [, pedidoIdStr] = venda.id.split(':');
    const pedidoId = parseInt(pedidoIdStr, 10);

    console.log(`🔍 Buscando pedido #${pedidoId} na API Tiny...\n`);

    const { tinyRequest } = require('../lib/tiny/client');
    
    // Buscar pedido
    const pedido = await tinyRequest({
      connection,
      path: `/pedidos/${pedidoId}`,
    });

    console.log('📄 ESTRUTURA DO PEDIDO (primeiros níveis):');
    console.log('   Chaves:', Object.keys(pedido).join(', '));
    
    // Normalizar pedido
    const p = pedido.pedido || pedido.retorno?.pedido || pedido;
    
    // Buscar itens
    const itens = p.itens?.item || p.itens || [];
    console.log(`\n📦 ITENS ENCONTRADOS: ${Array.isArray(itens) ? itens.length : 0}`);

    if (Array.isArray(itens) && itens.length > 0) {
      const item = itens[0];
      const produtoId = item?.produto?.id || item?.id_produto || item?.produtoId;
      
      console.log('\n   ITEM 1:');
      console.log(`      produto.id: ${produtoId}`);
      console.log(`      produto.descricao: ${item?.produto?.descricao || 'N/A'}`);
      console.log(`      produto.categoria: ${JSON.stringify(item?.produto?.categoria || null)}`);
      console.log(`      categoria no item: ${JSON.stringify(item?.categoria || null)}`);

      if (produtoId) {
        console.log(`\n🔍 Buscando produto #${produtoId} diretamente na API...\n`);

        try {
          const produto = await tinyRequest({
            connection,
            path: `/produtos/${produtoId}`,
          });

          console.log('📦 RESPOSTA DO PRODUTO:');
          console.log('   Chaves:', Object.keys(produto).join(', '));
          
          const prod = produto.produto || produto.retorno?.produto || produto;
          
          console.log('\n   CATEGORIA NO PRODUTO:');
          console.log(`      categoria: ${JSON.stringify(prod.categoria || null)}`);
          console.log(`      categoria.id: ${prod.categoria?.id || 'N/A'}`);
          console.log(`      categoria.nome: ${prod.categoria?.nome || 'N/A'}`);
          console.log(`      categoria.descricao: ${prod.categoria?.descricao || 'N/A'}`);

          console.log('\n✅ CONCLUSÃO:');
          if (prod.categoria?.nome) {
            console.log(`   ✅ Categoria EXISTE na API: "${prod.categoria.nome}"`);
            console.log(`   ⚠️  Mas o banco mostra: "${venda.categoria}"`);
            console.log('   → Problema: enrichment não está funcionando ou não salvou');
          } else {
            console.log('   ❌ Categoria NÃO existe na API Tiny para este produto');
            console.log('   → "N/D" está correto');
          }

        } catch (err) {
          console.log(`   ❌ Erro ao buscar produto: ${err.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
