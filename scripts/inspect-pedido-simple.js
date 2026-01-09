/**
 * Script simplificado para inspecionar pedido do Tiny
 * USO: node scripts/inspect-pedido-simple.js <pedidoId>
 */

const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');
const crypto = require('crypto');

config();

const prisma = new PrismaClient();

// Descriptografar token (usando mesmo algoritmo do lib/crypto.ts)
function decrypt(payload) {
  const ALGO = "aes-256-gcm";
  const IV_LENGTH = 12;
  const AUTH_TAG_LENGTH = 16;
  
  const key = Buffer.from(process.env.ENCRYPTION_MASTER_KEY || '', 'base64');
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_MASTER_KEY inválida");
  }
  
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGO, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

async function inspectPedido(pedidoId) {
  console.log(`\n🔍 INSPECIONANDO PEDIDO #${pedidoId} NA API TINY\n`);

  try {
    // Buscar TinyConnection
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    console.log('✅ Conectado ao Tiny\n');

    // Descriptografar access token
    const accessToken = decrypt(connection.accessTokenEnc);

    // Fazer requisição para API Tiny V3
    const response = await fetch(
      `https://api.tiny.com.br/public-api/v3/pedidos/${pedidoId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('═══════════════════════════════════════════════════════');
    console.log('📦 RESPOSTA COMPLETA DA API (primeiras chaves):');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Chaves raiz:', Object.keys(data).join(', '));
    console.log('');

    // Normalizar resposta
    const pedido = data.pedido || data.retorno?.pedido || data;

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

      // Buscar produto completo
      const produtoId = item?.produto?.id || item?.id_produto || item?.produtoId;
      if (produtoId) {
        console.log('\n   ─────────────────────────────────────────────────');
        console.log(`   🔍 Buscando produto #${produtoId} completo...`);
        
        try {
          const prodResponse = await fetch(
            `https://api.tiny.com.br/public-api/v3/produtos/${produtoId}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (prodResponse.ok) {
            const prodData = await prodResponse.json();
            const produto = prodData.produto || prodData.retorno?.produto || prodData;
            
            console.log(`   \n   PRODUTO #${produtoId} (categorias):`);
            console.log(`   produto.categoria: ${JSON.stringify(produto.categoria || null)}`);
            console.log(`   produto.grupo: ${JSON.stringify(produto.grupo || null)}`);
            
            if (produto.categoria?.nome) {
              console.log(`   \n   ✅ CATEGORIA EXISTE: "${produto.categoria.nome}"`);
            } else {
              console.log(`   \n   ❌ CATEGORIA NÃO EXISTE no endpoint /produtos/{id}`);
            }
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
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Obter pedidoId do argumento
const pedidoId = process.argv[2];

if (!pedidoId) {
  console.error('❌ Uso: node scripts/inspect-pedido-simple.js <pedidoId>');
  console.error('   Exemplo: node scripts/inspect-pedido-simple.js 12345');
  process.exit(1);
}

inspectPedido(pedidoId);
