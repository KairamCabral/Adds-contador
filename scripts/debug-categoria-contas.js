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

async function debug() {
  console.log('\n🔍 DEBUG - POR QUE CATEGORIA ESTÁ N/D?\n');

  try {
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // IDs das contas que aparecem na tela
    const contasIds = [
      914786012, 914786586, 914790696, 914790874, 914803489,
      914804309, 914806145, 914806422, 914806425, 914806427
    ];

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔎 VERIFICANDO CATEGORIAS DAS CONTAS NA TELA');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const contaId of contasIds.slice(0, 5)) { // Primeiras 5
      console.log(`\n📋 Conta ID: ${contaId}`);
      console.log('─────────────────────────────────────────────────────');

      const response = await fetch(
        `https://erp.tiny.com.br/public-api/v3/contas-receber/${contaId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.log(`❌ Erro ${response.status}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      console.log(`Cliente: ${data.cliente?.nome || 'N/A'}`);
      console.log(`Valor: R$ ${data.valor}`);
      console.log(`\n❓ CAMPO CATEGORIA:`);
      console.log(`   categoria: ${JSON.stringify(data.categoria, null, 2)}`);
      
      // Procurar qualquer campo com "categ" ou "id"
      console.log(`\n🔍 TODOS OS CAMPOS COM 'ID' OU 'CATEGORIA':`);
      Object.keys(data).forEach(key => {
        if (key.toLowerCase().includes('id') || key.toLowerCase().includes('categ')) {
          console.log(`   ${key}: ${JSON.stringify(data[key])}`);
        }
      });

      // Verificar se existe idCategoria ou similar
      const possibleCategoryIds = [
        data.idCategoria,
        data.id_categoria,
        data.categoriaId,
        data.categoria_id,
        data.categoria?.id
      ].filter(Boolean);

      if (possibleCategoryIds.length > 0) {
        console.log(`\n✅ POSSÍVEL ID DE CATEGORIA ENCONTRADO: ${possibleCategoryIds[0]}`);
        
        // Tentar buscar na API de categorias
        console.log(`\n🔎 Buscando categoria via /categorias-receita-despesa...`);
        
        const catResponse = await fetch(
          `https://erp.tiny.com.br/public-api/v3/categorias-receita-despesa?limit=100`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (catResponse.ok) {
          const catData = await catResponse.json();
          const categorias = catData.itens || catData.data || [];
          const catEncontrada = categorias.find(c => c.id === possibleCategoryIds[0]);
          
          if (catEncontrada) {
            console.log(`✅ CATEGORIA ENCONTRADA: ${catEncontrada.descricao} (grupo: ${catEncontrada.grupo})`);
          } else {
            console.log(`⚠️  Categoria ID ${possibleCategoryIds[0]} não encontrada na lista`);
          }
        }
      } else {
        console.log(`\n❌ NENHUM ID DE CATEGORIA ENCONTRADO`);
        console.log(`   → Campo 'categoria' está null ou vazio`);
        console.log(`   → Não há como fazer enrichment`);
      }
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('💡 CONCLUSÃO:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Se TODAS as contas têm categoria = null:');
    console.log('   ❌ Tiny não vincula categoria automaticamente');
    console.log('   → Usuário precisa cadastrar manualmente no Tiny ERP\n');
    console.log('Se ALGUMAS contas têm categoria.id:');
    console.log('   ✅ Podemos fazer enrichment!');
    console.log('   → Buscar descrição via /categorias-receita-despesa\n');

    console.log('✅ DEBUG COMPLETO\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
