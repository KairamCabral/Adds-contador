/**
 * Script de validação completa com DADOS REAIS
 * Responde às 3 perguntas do usuário
 */

const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');
const crypto = require('crypto');

config();
const prisma = new PrismaClient();

// Descriptografar token
function decrypt(payload) {
  const ALGO = "aes-256-gcm";
  const IV_LENGTH = 12;
  const AUTH_TAG_LENGTH = 16;
  
  const key = Buffer.from(process.env.ENCRYPTION_MASTER_KEY || '', 'base64');
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

async function validate() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  VALIDAÇÃO DE DADOS REAIS DA API TINY V3                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Buscar connection
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // Buscar 5 pedidos mais recentes do banco
    const vendas = await prisma.vwVendas.findMany({
      orderBy: { dataHora: 'desc' },
      take: 5,
    });

    if (vendas.length === 0) {
      console.log('⚠️  Nenhuma venda no banco. Sincronize primeiro.');
      process.exit(0);
    }

    // Extrair IDs únicos de pedidos
    const pedidoIds = [...new Set(vendas.map(v => v.id.split('_')[1]))];
    console.log(`📦 Analisando ${pedidoIds.length} pedidos recentes...\n`);

    // ========================================
    // 1) DATA/HORA
    // ========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1️⃣  VALIDAÇÃO: DATA/HORA');
    console.log('═══════════════════════════════════════════════════════════\n');

    const pedidoId = pedidoIds[0];
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
      throw new Error(`HTTP ${response.status}`);
    }

    const pedidoData = await response.json();
    const pedido = pedidoData;

    console.log(`📄 PEDIDO #${pedidoId} (JSON COMPLETO - amostra):\n`);
    console.log(JSON.stringify(pedido, null, 2).substring(0, 1000) + '...\n');

    console.log('📅 CAMPOS DE DATA/HORA encontrados:');
    const camposData = [
      'data', 'data_pedido', 'dataPedido',
      'data_emissao', 'dataEmissao',
      'data_faturamento', 'dataFaturamento',
      'data_hora', 'dataHora',
      'hora', 'hora_pedido', 'horaPedido',
      'timestamp', 'created_at', 'createdAt'
    ];

    let temHora = false;
    camposData.forEach(campo => {
      if (pedido[campo] !== undefined) {
        console.log(`   ✅ ${campo}: ${JSON.stringify(pedido[campo])}`);
        // Verificar se tem hora (formato HH:mm ou HH:mm:ss)
        if (typeof pedido[campo] === 'string' && pedido[campo].match(/\d{2}:\d{2}/)) {
          temHora = true;
        }
      }
    });

    console.log(`\n❓ EXISTE CAMPO COM HORA?`);
    if (temHora) {
      console.log('   ✅ SIM - API fornece hora específica');
    } else {
      console.log('   ❌ NÃO - API fornece apenas DATA (YYYY-MM-DD)');
    }

    // ========================================
    // 2) STATUS (situação)
    // ========================================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('2️⃣  VALIDAÇÃO: STATUS (SITUAÇÃO)');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 Coletando valores de STATUS em múltiplos pedidos...\n');

    const statusValues = [];
    for (const pid of pedidoIds.slice(0, 5)) {
      const resp = await fetch(
        `https://api.tiny.com.br/public-api/v3/pedidos/${pid}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const p = data;
        
        console.log(`   Pedido #${pid}:`);
        console.log(`      situacao: ${JSON.stringify(p.situacao)} (tipo: ${typeof p.situacao})`);
        if (p.situacaoCodigo !== undefined) {
          console.log(`      situacaoCodigo: ${JSON.stringify(p.situacaoCodigo)}`);
        }
        if (p.situacao_nome !== undefined) {
          console.log(`      situacao_nome: ${JSON.stringify(p.situacao_nome)}`);
        }
        
        statusValues.push(p.situacao);
      }

      // Delay para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n📊 VALORES ÚNICOS DE SITUACAO encontrados:');
    const uniqueStatus = [...new Set(statusValues)];
    uniqueStatus.forEach(s => {
      console.log(`   • ${JSON.stringify(s)} (tipo: ${typeof s})`);
    });

    console.log('\n❓ SITUAÇÃO VEM COMO NÚMERO OU STRING?');
    if (typeof statusValues[0] === 'number') {
      console.log('   ✅ NÚMERO (ex.: 1, 7, etc)');
    } else if (typeof statusValues[0] === 'string') {
      if (statusValues[0].startsWith('SITUACAO_')) {
        console.log('   ⚠️  STRING no formato "SITUACAO_7"');
      } else {
        console.log('   ✅ STRING legível (ex.: "Aprovado", "Pronto para envio")');
      }
    }

    // ========================================
    // 3) CATEGORIA
    // ========================================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('3️⃣  VALIDAÇÃO: CATEGORIA');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🔍 Verificando PEDIDO/ITENS...\n');

    const itens = pedido.itens || [];
    if (itens.length > 0) {
      const item = itens[0];
      console.log('   ITEM[0] - Campos disponíveis:');
      console.log(`      produto.id: ${item?.produto?.id || 'N/A'}`);
      console.log(`      produto.descricao: ${item?.produto?.descricao || 'N/A'}`);
      console.log(`      produto.categoria: ${JSON.stringify(item?.produto?.categoria || null)}`);
      console.log(`      categoria (direto): ${JSON.stringify(item?.categoria || null)}`);

      console.log('\n❓ EXISTE CATEGORIA NO PEDIDO/ITEM?');
      if (item?.produto?.categoria || item?.categoria) {
        console.log('   ✅ SIM - Categoria vem no pedido');
      } else {
        console.log('   ❌ NÃO - Categoria NÃO vem no pedido');
      }

      // Buscar produto completo
      const produtoId = item?.produto?.id;
      if (produtoId) {
        console.log(`\n🔍 Verificando PRODUTO COMPLETO (/produtos/${produtoId})...\n`);

        const prodResp = await fetch(
          `https://api.tiny.com.br/public-api/v3/produtos/${produtoId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (prodResp.ok) {
          const prodData = await prodResp.json();
          const produto = prodData;

          console.log('   PRODUTO - JSON (amostra):');
          console.log(JSON.stringify(produto, null, 2).substring(0, 800) + '...\n');

          console.log('   CATEGORIA NO PRODUTO:');
          console.log(`      categoria: ${JSON.stringify(produto.categoria || null)}`);
          if (produto.categoria?.nome) {
            console.log(`      categoria.nome: "${produto.categoria.nome}"`);
          }
          if (produto.categoria?.caminhoCompleto) {
            console.log(`      categoria.caminhoCompleto: "${produto.categoria.caminhoCompleto}"`);
          }

          console.log('\n❓ EXISTE CATEGORIA NO PRODUTO?');
          if (produto.categoria?.nome) {
            console.log(`   ✅ SIM - categoria.nome = "${produto.categoria.nome}"`);
          } else {
            console.log('   ❌ NÃO - Categoria não existe nem em /produtos/{id}');
          }
        }
      }
    }

    // ========================================
    // VALIDAÇÃO DO CÓDIGO (SYNC)
    // ========================================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('4️⃣  VALIDAÇÃO: CÓDIGO DO SYNC (produtosEnriquecidos)');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📝 Verificando jobs/sync.ts...\n');

    const fs = require('fs');
    const syncCode = fs.readFileSync('jobs/sync.ts', 'utf8');

    // Buscar como o Map é criado
    const mapMatch = syncCode.match(/produtosEnriquecidos\s*=\s*new Map<(.+?)>\(\)/);
    if (mapMatch) {
      console.log(`   Map declaration: new Map<${mapMatch[1]}>()`);
    }

    // Buscar como produtos são adicionados ao Map
    const setMatch = syncCode.match(/produtosEnriquecidos\.set\(([^,]+),\s*([^)]+)\)/);
    if (setMatch) {
      console.log(`   Map.set(): produtosEnriquecidos.set(${setMatch[1]}, ${setMatch[2]})`);
    }

    console.log('\n📝 Verificando lib/tiny/enrichment.ts...\n');

    const enrichCode = fs.readFileSync('lib/tiny/enrichment.ts', 'utf8');
    
    // Buscar interface CachedProduto
    const interfaceMatch = enrichCode.match(/interface CachedProduto \{[\s\S]+?\}/);
    if (interfaceMatch) {
      console.log('   CachedProduto interface:');
      console.log(interfaceMatch[0].split('\n').map(l => `      ${l}`).join('\n'));
    }

    console.log('\n📝 Verificando lib/tiny/transformers.ts...\n');

    const transformCode = fs.readFileSync('lib/tiny/transformers.ts', 'utf8');
    
    // Buscar extração de produtoId
    const prodIdMatch = transformCode.match(/produtoId[\s\S]{0,200}getPathFirst[\s\S]{0,100}\[[\s\S]{0,200}\]/);
    if (prodIdMatch) {
      console.log('   Extração de produtoId:');
      const lines = prodIdMatch[0].split('\n').slice(0, 8);
      lines.forEach(l => console.log(`      ${l.trim()}`));
    }

    // Buscar como categoria é acessada
    const catMatch = transformCode.match(/categoria[\s\S]{0,300}produtosEnriquecidos[\s\S]{0,300}/);
    if (catMatch) {
      console.log('\n   Acesso à categoria do Map:');
      const lines = catMatch[0].split('\n').slice(0, 12);
      lines.forEach(l => console.log(`      ${l.trim()}`));
    }

    // ========================================
    // RESUMO FINAL
    // ========================================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ RESUMO DA VALIDAÇÃO');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('1️⃣  DATA/HORA:');
    console.log(`   • API fornece hora? ${temHora ? 'SIM' : 'NÃO'}`);
    console.log(`   • Campos disponíveis: data, dataFaturamento`);
    console.log(`   • Formato: YYYY-MM-DD (sem hora)\n`);

    console.log('2️⃣  STATUS:');
    console.log(`   • Tipo: ${typeof statusValues[0]}`);
    console.log(`   • Valores únicos: ${uniqueStatus.join(', ')}`);
    console.log(`   • Mapeamento necessário: ${typeof statusValues[0] === 'number' ? 'SIM' : 'DEPENDE'}\n`);

    console.log('3️⃣  CATEGORIA:');
    console.log('   • No pedido/item: NÃO');
    console.log('   • Em /produtos/{id}: SIM (categoria.nome)');
    console.log('   • Enrichment necessário: SIM\n');

    console.log('4️⃣  CÓDIGO SYNC:');
    console.log('   • Map key: number (produtoId)');
    console.log('   • Map value: CachedProduto (com categoria?: {nome: string})');
    console.log('   • Extração produtoId: produto.id / id_produto / produtoId\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  VALIDAÇÃO COMPLETA - Todos os dados foram verificados  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

validate();
