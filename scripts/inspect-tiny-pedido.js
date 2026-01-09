/**
 * Script para inspecionar estrutura REAL de um pedido do Tiny
 * USO: node scripts/inspect-tiny-pedido.mjs <pedidoId>
 * Exemplo: node scripts/inspect-tiny-pedido.mjs 12345
 */

const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

// Carregar .env
config();

const prisma = new PrismaClient();

async function inspectPedido(pedidoId) {
  console.log(`\n🔍 INSPECIONANDO PEDIDO #${pedidoId} NA API TINY\n`);

  try {
    // Buscar TinyConnection mais recente
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection ativa encontrada');
      process.exit(1);
    }

    console.log('✅ Conectado ao Tiny\n');

    // Importar o client Tiny (CommonJS)
    const { tinyRequest } = require('../lib/tiny/client');

    // Buscar pedido detalhe
    const response = await tinyRequest({
      connection,
      path: `/pedidos/${pedidoId}`,
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('📦 RESPOSTA COMPLETA DA API (primeiras chaves):');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Chaves raiz:', Object.keys(response).join(', '));
    console.log('');

    // Normalizar (pedido pode estar em response.pedido ou response.retorno.pedido)
    const pedido = response.pedido || response.retorno?.pedido || response;

    console.log('═══════════════════════════════════════════════════════');
    console.log('📅 A) CAMPOS DE DATA/HORA:');
    console.log('═══════════════════════════════════════════════════════');
    
    const camposData = [
      'data', 'data_pedido', 'dataPedido', 
      'data_emissao', 'dataEmissao',
      'data_faturamento', 'dataFaturamento',
      'data_hora', 'dataHora',
      'hora', 'hora_pedido', 'horaPedido',
      'data_prevista', 'dataPrevista',
    ];

    camposData.forEach(campo => {
      if (pedido[campo] !== undefined) {
        console.log(`   ${campo}: ${JSON.stringify(pedido[campo])}`);
      }
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 B) CAMPOS DE STATUS/SITUAÇÃO:');
    console.log('═══════════════════════════════════════════════════════');
    
    const camposStatus = [
      'situacao', 'situacaoCodigo', 'situacao_codigo',
      'status', 'statusCodigo', 'status_codigo',
      'situacao_nome', 'situacaoNome',
    ];

    camposStatus.forEach(campo => {
      if (pedido[campo] !== undefined) {
        console.log(`   ${campo}: ${JSON.stringify(pedido[campo])}`);
      }
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📦 C) ITENS DO PEDIDO:');
    console.log('═══════════════════════════════════════════════════════');

    // Tentar múltiplas estruturas de itens
    let itens = pedido.itens?.item || pedido.itens || [];
    if (!Array.isArray(itens)) {
      itens = [itens];
    }

    console.log(`   Total de itens: ${itens.length}`);
    console.log(`   Estrutura: pedido.itens${pedido.itens?.item ? '.item' : ''}`);

    if (itens.length > 0) {
      const item = itens[0];
      console.log('\n   ITEM 1 (campos relevantes):');
      console.log('   ─────────────────────────────────────────────────');
      
      // Produto
      console.log(`   produto.id: ${item?.produto?.id || item?.id_produto || item?.produtoId || 'N/A'}`);
      console.log(`   produto.descricao: ${item?.produto?.descricao || item?.descricao || 'N/A'}`);
      console.log(`   produto.nome: ${item?.produto?.nome || item?.nome || 'N/A'}`);
      console.log(`   produto.sku: ${item?.produto?.sku || item?.sku || 'N/A'}`);
      console.log(`   produto.codigo: ${item?.produto?.codigo || item?.codigo || 'N/A'}`);
      
      // Categoria/Grupo
      console.log('\n   CATEGORIA/GRUPO NO ITEM:');
      if (item?.produto?.categoria) {
        console.log(`   produto.categoria: ${JSON.stringify(item.produto.categoria)}`);
      } else {
        console.log(`   produto.categoria: não existe`);
      }
      
      if (item?.categoria) {
        console.log(`   categoria (direto): ${JSON.stringify(item.categoria)}`);
      } else {
        console.log(`   categoria (direto): não existe`);
      }
      
      if (item?.produto?.grupo) {
        console.log(`   produto.grupo: ${JSON.stringify(item.produto.grupo)}`);
      }
      
      if (item?.grupo) {
        console.log(`   grupo (direto): ${JSON.stringify(item.grupo)}`);
      }

      // Buscar produto completo para ver se categoria vem de lá
      const produtoId = item?.produto?.id || item?.id_produto || item?.produtoId;
      if (produtoId) {
        console.log('\n   ─────────────────────────────────────────────────');
        console.log(`   🔍 Buscando produto #${produtoId} completo...`);
        
        try {
          const produtoResponse = await tinyRequest({
            connection,
            path: `/produtos/${produtoId}`,
          });

          const produto = produtoResponse.produto || produtoResponse.retorno?.produto || produtoResponse;
          
          console.log(`   \n   PRODUTO #${produtoId} (categorias):`);
          console.log(`   produto.categoria: ${JSON.stringify(produto.categoria || null)}`);
          console.log(`   produto.grupo: ${JSON.stringify(produto.grupo || null)}`);
          
          if (produto.categoria?.nome) {
            console.log(`   \n   ✅ CATEGORIA EXISTE: "${produto.categoria.nome}"`);
          } else {
            console.log(`   \n   ❌ CATEGORIA NÃO EXISTE no endpoint /produtos/{id}`);
          }
        } catch (err) {
          console.log(`   ❌ Erro ao buscar produto: ${err.message}`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ INSPEÇÃO COMPLETA');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Obter pedidoId do argumento
const pedidoId = process.argv[2];

if (!pedidoId) {
  console.error('❌ Uso: node scripts/inspect-tiny-pedido.mjs <pedidoId>');
  console.error('   Exemplo: node scripts/inspect-tiny-pedido.mjs 12345');
  process.exit(1);
}

inspectPedido(pedidoId);
