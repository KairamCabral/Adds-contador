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
  console.log('\n🔍 INSPECIONANDO CONTAS A RECEBER\n');

  try {
    const connection = await prisma.tinyConnection.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection) {
      console.error('❌ Nenhuma TinyConnection encontrada');
      process.exit(1);
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // Buscar contas a receber
    const hoje = new Date().toISOString().split('T')[0];
    const tresMesesAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`📅 Buscando contas de ${tresMesesAtras} até ${hoje}`);

    const response = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber?dataInicial=${tresMesesAtras}&dataFinal=${hoje}&pagina=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
    }

    const data = await response.json();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📄 ESTRUTURA COMPLETA DO JSON (primeiros 2000 chars):');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(data, null, 2).substring(0, 2000) + '...\n');

    // Pegar primeira conta
    const contas = data.itens || data.data || data.contas || data;
    if (Array.isArray(contas) && contas.length > 0) {
      const conta = contas[0];

      console.log('═══════════════════════════════════════════════════════');
      console.log('📋 PRIMEIRA CONTA A RECEBER:');
      console.log('═══════════════════════════════════════════════════════\n');

      console.log('CAMPOS BÁSICOS:');
      console.log(`   id: ${conta.id}`);
      console.log(`   numero_documento: ${conta.numero_documento || conta.numeroDocumento || 'N/A'}`);
      console.log(`   cliente.nome: ${conta.cliente?.nome || 'N/A'}`);
      console.log(`   cliente.cpf_cnpj: ${conta.cliente?.cpf_cnpj || conta.cliente?.cpfCnpj || 'N/A'}`);
      console.log(`   valor: ${conta.valor}`);
      console.log(`   situacao: ${conta.situacao}`);
      console.log(`   data_emissao: ${conta.data_emissao || conta.dataEmissao || 'N/A'}`);
      console.log(`   data_vencimento: ${conta.data_vencimento || conta.dataVencimento || 'N/A'}`);

      console.log('\n❓ CATEGORIA:');
      console.log(`   categoria: ${JSON.stringify(conta.categoria)}`);
      console.log(`   categoria (tipo): ${typeof conta.categoria}`);
      
      if (typeof conta.categoria === 'object' && conta.categoria !== null) {
        console.log(`   categoria.nome: ${conta.categoria.nome || 'N/A'}`);
        console.log(`   categoria.id: ${conta.categoria.id || 'N/A'}`);
      }

      console.log('\n❓ CENTRO DE CUSTO:');
      console.log(`   centro_custo: ${JSON.stringify(conta.centro_custo)}`);
      console.log(`   centroCusto: ${JSON.stringify(conta.centroCusto)}`);
      console.log(`   centro_custo (tipo): ${typeof conta.centro_custo}`);
      console.log(`   centroCusto (tipo): ${typeof conta.centroCusto}`);
      
      if (typeof conta.centro_custo === 'object' && conta.centro_custo !== null) {
        console.log(`   centro_custo.nome: ${conta.centro_custo.nome || 'N/A'}`);
      }
      if (typeof conta.centroCusto === 'object' && conta.centroCusto !== null) {
        console.log(`   centroCusto.nome: ${conta.centroCusto.nome || 'N/A'}`);
      }

      console.log('\n📦 CONTA COMPLETA:');
      console.log(JSON.stringify(conta, null, 2));
    } else {
      console.log('⚠️  Nenhuma conta encontrada no período');
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
