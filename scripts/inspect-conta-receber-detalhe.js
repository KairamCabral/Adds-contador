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
  console.log('\n🔍 BUSCANDO DETALHE DE CONTA A RECEBER\n');

  try {
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // Primeiro buscar uma conta
    const hoje = new Date().toISOString().split('T')[0];
    const tresMesesAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const listResponse = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber?dataInicial=${tresMesesAtras}&dataFinal=${hoje}&pagina=1`,
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

    if (contas.length === 0) {
      console.log('⚠️  Nenhuma conta encontrada no período');
      process.exit(0);
    }

    const contaId = contas[0].id;
    console.log(`📋 Conta ID: ${contaId}`);
    console.log(`   Cliente: ${contas[0].cliente?.nome}`);
    console.log(`   Valor: R$ ${contas[0].valor}\n`);

    // Agora buscar detalhe
    console.log('🔎 Tentando buscar detalhe em /contas-receber/{id}...\n');

    const detalheResponse = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber/${contaId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Status: ${detalheResponse.status} ${detalheResponse.statusText}`);

    if (detalheResponse.ok) {
      const detalheData = await detalheResponse.json();
      
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('✅ DETALHE DA CONTA (JSON COMPLETO):');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log(JSON.stringify(detalheData, null, 2));

      // Verificar campos específicos
      const conta = detalheData.data || detalheData;
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('🔍 CAMPOS IMPORTANTES:');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log(`categoria: ${JSON.stringify(conta.categoria)}`);
      console.log(`centroCusto: ${JSON.stringify(conta.centroCusto || conta.centro_custo)}`);
      console.log(`planoContas: ${JSON.stringify(conta.planoContas || conta.plano_contas)}`);
    } else {
      const errorText = await detalheResponse.text();
      console.log(`\n❌ Endpoint de detalhe não disponível ou erro:`);
      console.log(errorText);
      
      console.log('\n⚠️  CONCLUSÃO: API Tiny não fornece categoria/centro de custo para contas a receber');
      console.log('   Esses campos devem ser mantidos como "N/D" ou null no sistema.');
    }

    console.log('\n✅ INSPEÇÃO COMPLETA\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
