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
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

async function testDetalhe() {
  console.log('\n🔍 TESTE: ENDPOINT DE DETALHE - CONTAS A PAGAR\n');

  try {
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection || !connection.accessTokenEnc) {
      console.error('❌ Connection não encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // Pegar IDs das contas da screenshot: 914743802, 914697339, 914697541
    const contaIds = [914743802, 914697339, 914697541];

    for (const contaId of contaIds) {
      console.log(`═══════════════════════════════════════════════════════`);
      console.log(`📋 Buscando detalhe da conta ${contaId}...`);
      console.log(`═══════════════════════════════════════════════════════\n`);

      try {
        const response = await fetch(
          `https://erp.tiny.com.br/public-api/v3/contas-pagar/${contaId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.log(`❌ HTTP ${response.status}: ${response.statusText}\n`);
          continue;
        }

        const detalhe = await response.json();

        console.log('📄 ESTRUTURA COMPLETA:');
        console.log(JSON.stringify(detalhe, null, 2));

        console.log('\n❓ CAMPOS CRÍTICOS:');
        console.log(`   categoria: ${JSON.stringify(detalhe.categoria)}`);
        console.log(`   categoria (tipo): ${typeof detalhe.categoria}`);
        
        console.log(`\n   centroCusto: ${JSON.stringify(detalhe.centroCusto)}`);
        console.log(`   centro_custo: ${JSON.stringify(detalhe.centro_custo)}`);
        console.log(`   centroCusto (tipo): ${typeof (detalhe.centroCusto || detalhe.centro_custo)}`);
        
        console.log(`\n   formaPagamento: ${JSON.stringify(detalhe.formaPagamento)}`);
        console.log(`   forma_pagamento: ${JSON.stringify(detalhe.forma_pagamento)}`);
        console.log(`   formaPagamento (tipo): ${typeof (detalhe.formaPagamento || detalhe.forma_pagamento)}`);

        console.log('\n   Todos os campos disponíveis:');
        console.log(`   ${Object.keys(detalhe).join(', ')}\n`);

      } catch (err) {
        console.log(`❌ Erro ao buscar conta ${contaId}: ${err.message}\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('💡 CONCLUSÃO GERAL:');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('Se categoria/centroCusto existem no detalhe:');
    console.log('   ✅ SOLUÇÃO: Implementar enrichment (buscar detalhe antes de transformar)\n');
    
    console.log('Se NÃO existem no detalhe:');
    console.log('   ❌ LIMITAÇÃO: API Tiny não fornece esses campos');
    console.log('   💡 Alternativa: Mapeamento manual ou integração diferente\n');

    console.log('✅ TESTE COMPLETO\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDetalhe();
