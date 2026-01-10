/**
 * DEBUG: Chamada HTTP direta à API Tiny
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
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

async function debugAPI() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔬 DEBUG: CHAMADA DIRETA API TINY                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Buscar connection
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // 2. Buscar 1 conta recebida do banco
    const conta = await prisma.vwContasRecebidas.findFirst({
      orderBy: { dataRecebimento: 'desc' }
    });

    if (!conta) {
      console.log('⚠️  Nenhuma conta recebida encontrada no banco');
      return;
    }

    console.log(`📋 Conta ID: ${conta.tituloId}`);
    console.log(`   Cliente: ${conta.cliente}`);
    console.log(`   Forma Recebimento (banco): "${conta.formaRecebimento}"`);
    console.log(`   Conta Bancária (banco): "${conta.contaBancaria}"\n`);

    // 3. Buscar detalhe na API
    console.log(`🔎 Buscando detalhe na API: /contas-receber/${conta.tituloId}\n`);

    const response = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber/${conta.tituloId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    if (response.ok) {
      const data = await response.json();
      
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✅ RESPOSTA COMPLETA DA API:');
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n═══════════════════════════════════════════════════════════════\n');

      // Análise específica
      console.log('🔍 ANÁLISE DE CAMPOS ESPECÍFICOS:\n');
      
      console.log('💳 FORMA PAGAMENTO:');
      if (data.formaPagamento !== undefined) {
        console.log(`   ✅ formaPagamento: ${JSON.stringify(data.formaPagamento)}`);
        console.log(`      typeof: ${typeof data.formaPagamento}`);
      } else {
        console.log('   ❌ formaPagamento: não existe');
      }
      
      if (data.forma_pagamento !== undefined) {
        console.log(`   ✅ forma_pagamento: ${JSON.stringify(data.forma_pagamento)}`);
        console.log(`      typeof: ${typeof data.forma_pagamento}`);
      } else {
        console.log('   ❌ forma_pagamento: não existe');
      }

      console.log('\n🏦 CONTA BANCÁRIA:');
      if (data.contaBancaria !== undefined) {
        console.log(`   ✅ contaBancaria: ${JSON.stringify(data.contaBancaria)}`);
        console.log(`      typeof: ${typeof data.contaBancaria}`);
      } else {
        console.log('   ❌ contaBancaria: não existe');
      }
      
      if (data.conta_bancaria !== undefined) {
        console.log(`   ✅ conta_bancaria: ${JSON.stringify(data.conta_bancaria)}`);
        console.log(`      typeof: ${typeof data.conta_bancaria}`);
      } else {
        console.log('   ❌ conta_bancaria: não existe');
      }

      console.log('\n📋 CAMPOS ALTERNATIVOS:');
      const camposAlternativos = [
        'meioPagamento', 'meio_pagamento',
        'tipoPagamento', 'tipo_pagamento',
        'banco', 'nomeBanco', 'nome_banco',
        'contaRecebimento', 'conta_recebimento'
      ];
      
      camposAlternativos.forEach(campo => {
        if (data[campo] !== undefined) {
          console.log(`   ✅ ${campo}: ${JSON.stringify(data[campo])}`);
        }
      });

      console.log('\n📋 TODOS OS CAMPOS DA RESPOSTA:');
      Object.keys(data).sort().forEach(key => {
        const value = data[key];
        const tipo = typeof value;
        if (tipo === 'object' && value !== null) {
          console.log(`   - ${key} (object): ${JSON.stringify(value).substring(0, 60)}...`);
        } else {
          console.log(`   - ${key} (${tipo}): ${JSON.stringify(value)}`);
        }
      });

    } else {
      const errorText = await response.text();
      console.error(`❌ Erro na API: ${errorText}`);
    }

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

debugAPI().catch(console.error);
