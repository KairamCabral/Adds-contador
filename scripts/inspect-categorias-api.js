const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');
const crypto = require('crypto');

config();
const prisma = new PrismaClient();

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

async function inspect() {
  console.log('\n🔍 INVESTIGANDO CATEGORIAS DE RECEITA/DESPESA\n');

  try {
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // 1. Buscar categorias
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 BUSCANDO CATEGORIAS DE RECEITA/DESPESA');
    console.log('═══════════════════════════════════════════════════════\n');

    const categoriasResponse = await fetch(
      'https://erp.tiny.com.br/public-api/v3/categorias-receita-despesa?limit=10',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!categoriasResponse.ok) {
      const text = await categoriasResponse.text();
      throw new Error(`HTTP ${categoriasResponse.status}: ${text}`);
    }

    const categoriasData = await categoriasResponse.json();
    console.log('✅ Categorias disponíveis:\n');
    console.log(JSON.stringify(categoriasData, null, 2).substring(0, 1500) + '...\n');

    const categorias = categoriasData.itens || categoriasData.data || [];
    if (categorias.length > 0) {
      console.log('📝 Primeiras 5 categorias:');
      categorias.slice(0, 5).forEach(cat => {
        console.log(`   [${cat.id}] ${cat.descricao} (grupo: ${cat.grupo})`);
      });
    }

    // 2. Buscar contas a receber e verificar se tem categoria_id
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔎 VERIFICANDO SE CONTAS A RECEBER TEM CATEGORIA_ID');
    console.log('═══════════════════════════════════════════════════════\n');

    const hoje = new Date().toISOString().split('T')[0];
    const umMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const contasResponse = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber?dataInicial=${umMesAtras}&dataFinal=${hoje}&pagina=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!contasResponse.ok) {
      throw new Error(`HTTP ${contasResponse.status}`);
    }

    const contasData = await contasResponse.json();
    const contas = contasData.itens || contasData.data || [];

    if (contas.length > 0) {
      const conta = contas[0];
      console.log('📋 PRIMEIRA CONTA A RECEBER:\n');
      console.log(JSON.stringify(conta, null, 2));

      console.log('\n❓ CAMPOS RELACIONADOS A CATEGORIA:');
      console.log(`   categoria: ${JSON.stringify(conta.categoria)}`);
      console.log(`   categoriaId: ${JSON.stringify(conta.categoriaId)}`);
      console.log(`   categoria_id: ${JSON.stringify(conta.categoria_id)}`);
      console.log(`   idCategoria: ${JSON.stringify(conta.idCategoria)}`);
      console.log(`   id_categoria: ${JSON.stringify(conta.id_categoria)}`);

      // Tentar endpoint de detalhe
      console.log('\n🔎 Buscando detalhe da conta...\n');
      const detalheResponse = await fetch(
        `https://erp.tiny.com.br/public-api/v3/contas-receber/${conta.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (detalheResponse.ok) {
        const detalhe = await detalheResponse.json();
        console.log('📄 DETALHE DA CONTA:\n');
        console.log(JSON.stringify(detalhe, null, 2));

        console.log('\n❓ CAMPOS RELACIONADOS A CATEGORIA (DETALHE):');
        console.log(`   categoria: ${JSON.stringify(detalhe.categoria)}`);
        console.log(`   categoriaId: ${JSON.stringify(detalhe.categoriaId)}`);
        console.log(`   categoria_id: ${JSON.stringify(detalhe.categoria_id)}`);
        console.log(`   idCategoria: ${JSON.stringify(detalhe.idCategoria)}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 CONCLUSÃO:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Se encontrar categoria_id/categoriaId/idCategoria:');
    console.log('   ✅ Podemos fazer ENRICHMENT das categorias!');
    console.log('   → Buscar categoria via /categorias-receita-despesa/{id}');
    console.log('   → Cachear em memória durante o sync');
    console.log('   → Preencher campo "categoria" com descricao\n');
    console.log('Se NÃO encontrar nenhum ID de categoria:');
    console.log('   ❌ Categoria realmente não está disponível');
    console.log('   → Manter como "N/D"\n');

    console.log('✅ INSPEÇÃO COMPLETA\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
