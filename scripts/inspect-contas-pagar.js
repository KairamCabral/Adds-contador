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
  console.log('\n🔍 ANÁLISE COMPLETA - CONTAS A PAGAR\n');

  try {
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // 1. LISTAGEM
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 PASSO 1: LISTAGEM (/contas-pagar)');
    console.log('═══════════════════════════════════════════════════════\n');

    const hoje = new Date().toISOString().split('T')[0];
    const umMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const listResponse = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-pagar?dataInicial=${umMesAtras}&dataFinal=${hoje}&pagina=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`HTTP ${listResponse.status}: ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    const contas = listData.itens || listData.data || [];
    
    if (contas.length > 0) {
      const conta = contas[0];
      
      console.log('📄 PRIMEIRA CONTA DA LISTAGEM:\n');
      console.log(JSON.stringify(conta, null, 2));

      console.log('\n❓ CAMPOS CRÍTICOS NA LISTAGEM:');
      console.log(`   fornecedor: ${JSON.stringify(conta.fornecedor)}`);
      console.log(`   fornecedor (tipo): ${typeof conta.fornecedor}`);
      console.log(`   categoria: ${JSON.stringify(conta.categoria)}`);
      console.log(`   categoria (tipo): ${typeof conta.categoria}`);
      console.log(`   centroCusto: ${JSON.stringify(conta.centroCusto)}`);
      console.log(`   centro_custo: ${JSON.stringify(conta.centro_custo)}`);
      console.log(`   formaPagamento: ${JSON.stringify(conta.formaPagamento)}`);
      console.log(`   forma_pagamento: ${JSON.stringify(conta.forma_pagamento)}`);

      // 2. DETALHE
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📋 PASSO 2: DETALHE (/contas-pagar/{id})');
      console.log('═══════════════════════════════════════════════════════\n');

      const detalheResponse = await fetch(
        `https://erp.tiny.com.br/public-api/v3/contas-pagar/${conta.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (detalheResponse.ok) {
        const detalhe = await detalheResponse.json();
        console.log('📄 DETALHE COMPLETO:\n');
        console.log(JSON.stringify(detalhe, null, 2));

        console.log('\n❓ CAMPOS CRÍTICOS NO DETALHE:');
        console.log(`   fornecedor: ${JSON.stringify(detalhe.fornecedor)}`);
        console.log(`   categoria: ${JSON.stringify(detalhe.categoria)}`);
        console.log(`   centroCusto: ${JSON.stringify(detalhe.centroCusto || detalhe.centro_custo)}`);
        console.log(`   formaPagamento: ${JSON.stringify(detalhe.formaPagamento || detalhe.forma_pagamento)}`);

        // COMPARAÇÃO
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('⚖️  LISTAGEM vs DETALHE');
        console.log('═══════════════════════════════════════════════════════\n');

        ['fornecedor', 'categoria', 'centroCusto', 'formaPagamento'].forEach(campo => {
          const snake_campo = campo.replace(/([A-Z])/g, '_$1').toLowerCase();
          const naLista = conta[campo] || conta[snake_campo];
          const noDetalhe = detalhe[campo] || detalhe[snake_campo];
          console.log(`${campo}:`);
          console.log(`   Lista:   ${JSON.stringify(naLista)}`);
          console.log(`   Detalhe: ${JSON.stringify(noDetalhe)}`);
          console.log(`   ${JSON.stringify(naLista) === JSON.stringify(noDetalhe) ? '✅ IGUAL' : '❌ DIFERENTE'}\n`);
        });
      } else {
        console.log(`❌ Erro ao buscar detalhe: ${detalheResponse.status}`);
      }
    } else {
      console.log('⚠️  Nenhuma conta a pagar encontrada');
    }

    console.log('\n✅ ANÁLISE COMPLETA\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
