/**
 * Script para diagnosticar se a categoria existe nos pedidos do Tiny
 * Execute: node scripts/debug-categoria.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 DIAGNÓSTICO DE CATEGORIA\n');

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

    // Buscar um pedido recente de vw_vendas
    const venda = await prisma.vwVendas.findFirst({
      orderBy: { dataHora: 'desc' },
    });

    if (!venda) {
      console.log('❌ Nenhuma venda encontrada');
      return;
    }

    console.log('📦 Venda encontrada:');
    console.log(`   ID: ${venda.id}`);
    console.log(`   Produto: ${venda.produto}`);
    console.log(`   Categoria: ${venda.categoria}`);
    console.log(`   Data: ${venda.dataHora.toLocaleString('pt-BR')}\n`);

    // Tentar buscar o pedido correspondente na API Tiny
    // Extrair numeroPedido do ID (formato: companyId:pedidoId)
    const [, pedidoId] = venda.id.split(':');
    
    console.log(`🔍 Buscando pedido #${pedidoId} na API Tiny...`);

    const { tinyRequest } = require('../lib/tiny/client');
    
    try {
      const pedidoDetalhe = await tinyRequest({
        connection,
        path: `/pedidos/${pedidoId}`,
      });

      console.log('\n📄 ESTRUTURA DO PEDIDO RETORNADO PELA API:');
      console.log(JSON.stringify(pedidoDetalhe, null, 2));

      // Analisar itens
      const itens = pedidoDetalhe?.itens || 
                    pedidoDetalhe?.pedido?.itens || 
                    pedidoDetalhe?.retorno?.pedido?.itens ||
                    [];

      console.log(`\n📦 ITENS ENCONTRADOS: ${Array.isArray(itens) ? itens.length : 0}`);

      if (Array.isArray(itens) && itens.length > 0) {
        itens.forEach((item, idx) => {
          console.log(`\n   ITEM ${idx + 1}:`);
          console.log(`      produto.id: ${item?.produto?.id || 'N/A'}`);
          console.log(`      produto.descricao: ${item?.produto?.descricao || 'N/A'}`);
          console.log(`      produto.categoria: ${JSON.stringify(item?.produto?.categoria || 'N/A')}`);
          console.log(`      categoria: ${JSON.stringify(item?.categoria || 'N/A')}`);
        });
      }

      // Verificar se há produtoId para buscar detalhes do produto
      if (Array.isArray(itens) && itens.length > 0 && itens[0]?.produto?.id) {
        const produtoId = itens[0].produto.id;
        console.log(`\n🔍 Buscando produto #${produtoId} na API Tiny...`);

        try {
          const produto = await tinyRequest({
            connection,
            path: `/produtos/${produtoId}`,
          });

          console.log('\n📦 ESTRUTURA DO PRODUTO RETORNADO PELA API:');
          console.log(JSON.stringify(produto, null, 2));
        } catch (err) {
          console.log(`   ❌ Erro ao buscar produto: ${err.message}`);
        }
      }

    } catch (err) {
      console.log(`   ❌ Erro ao buscar pedido: ${err.message}`);
    }

    console.log('\n✨ DIAGNÓSTICO COMPLETO!');
    console.log('\n📋 CONCLUSÃO:');
    console.log('   1. Se produto.categoria existe na API → bug de extração');
    console.log('   2. Se produto.categoria NÃO existe → a API Tiny não retorna categoria no pedido');
    console.log('   3. Se existe em /produtos/{id} mas não em /pedidos/{id} → usar enrichment\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
