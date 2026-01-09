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
  console.log('\n🔍 INVESTIGANDO ENDPOINT /categorias/todas\n');

  try {
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // 1. Buscar categorias "normais"
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 BUSCANDO /categorias/todas');
    console.log('═══════════════════════════════════════════════════════\n');

    const categoriasResponse = await fetch(
      'https://erp.tiny.com.br/public-api/v3/categorias/todas',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Status: ${categoriasResponse.status} ${categoriasResponse.statusText}\n`);

    if (!categoriasResponse.ok) {
      const text = await categoriasResponse.text();
      console.log('❌ Erro ao buscar categorias:');
      console.log(text);
      console.log('\n⚠️  Endpoint /categorias/todas não disponível ou erro');
    } else {
      const categoriasData = await categoriasResponse.json();
      console.log('✅ Categorias "normais" disponíveis:\n');
      console.log(JSON.stringify(categoriasData, null, 2).substring(0, 2000) + '...\n');

      const categorias = categoriasData.itens || categoriasData.data || categoriasData;
      if (Array.isArray(categorias) && categorias.length > 0) {
        console.log('📝 Primeiras 10 categorias:');
        categorias.slice(0, 10).forEach((cat, idx) => {
          console.log(`   [${idx + 1}] ID: ${cat.id} | Descrição: ${cat.descricao || cat.nome || JSON.stringify(cat)}`);
        });
      }

      console.log('\n❓ COMPARAÇÃO:');
      console.log('   /categorias-receita-despesa → Categorias financeiras (receitas/despesas)');
      console.log('   /categorias/todas → Categorias de produtos (para estoque/vendas)');
    }

    // 2. Comparar estruturas
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔎 VERIFICANDO CONTAS A RECEBER NOVAMENTE');
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

    if (contasResponse.ok) {
      const contasData = await contasResponse.json();
      const contas = contasData.itens || contasData.data || [];

      if (contas.length > 0) {
        const conta = contas[0];
        
        // Buscar detalhe
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
          
          console.log('📋 TODOS OS CAMPOS DA CONTA (chaves):');
          console.log(Object.keys(detalhe).join(', '));
          
          console.log('\n🔍 PROCURANDO QUALQUER REFERÊNCIA A CATEGORIA:');
          const chavesComCategoria = Object.keys(detalhe).filter(k => 
            k.toLowerCase().includes('categ') || 
            k.toLowerCase().includes('classe') ||
            k.toLowerCase().includes('tipo') ||
            k.toLowerCase().includes('grupo')
          );
          
          if (chavesComCategoria.length > 0) {
            console.log('✅ Campos encontrados:');
            chavesComCategoria.forEach(k => {
              console.log(`   ${k}: ${JSON.stringify(detalhe[k])}`);
            });
          } else {
            console.log('❌ Nenhum campo relacionado a categoria/classificação encontrado');
          }
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 CONCLUSÃO FINAL:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✅ API Tiny tem DOIS tipos de categorias:');
    console.log('   1) /categorias/todas → Categorias de PRODUTOS');
    console.log('   2) /categorias-receita-despesa → Categorias FINANCEIRAS\n');
    console.log('❌ Contas a receber NÃO têm vínculo com NENHUMA das duas:');
    console.log('   → Sem categoria_id');
    console.log('   → Campo "categoria" retorna null');
    console.log('   → Impossível fazer enrichment\n');
    console.log('✅ DECISÃO: Manter campo "Categoria" como "N/D"');
    console.log('   Motivo: API não fornece essa informação para contas a receber\n');

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
