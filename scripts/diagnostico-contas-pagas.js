/**
 * scripts/diagnostico-contas-pagas.js
 * Investigar estrutura real da API de contas pagas
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

async function investigar() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🔍 DIAGNÓSTICO: Contas Pagas - Estrutura da API        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // ETAPA 1: Buscar lista
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 ETAPA 1: DADOS DA LISTAGEM');
    console.log('═══════════════════════════════════════════════════════════\n');

    const respLista = await fetch(
      'https://erp.tiny.com.br/public-api/v3/contas-pagar?situacao=pago&dataInicial=2026-01-01&limite=1',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!respLista.ok) {
      console.error(`❌ Erro na listagem: ${respLista.status}`);
      return;
    }

    const lista = await respLista.json();
    
    if (!lista.itens || lista.itens.length === 0) {
      console.log('⚠️  Nenhuma conta paga encontrada no período');
      return;
    }

    const primeiraConta = lista.itens[0];
    console.log(`🔎 Primeira conta da lista (ID: ${primeiraConta.id}):\n`);
    console.log('Campos principais:');
    console.log(`   fornecedor/cliente: ${JSON.stringify(primeiraConta.cliente || primeiraConta.fornecedor)}`);
    console.log(`   categoria: ${JSON.stringify(primeiraConta.categoria)}`);
    console.log(`   centroCusto: ${JSON.stringify(primeiraConta.centroCusto)}`);
    console.log(`   formaPagamento: ${JSON.stringify(primeiraConta.formaPagamento || primeiraConta.forma_pagamento)}`);
    console.log(`   contaBancaria: ${JSON.stringify(primeiraConta.contaBancaria || primeiraConta.conta_bancaria)}`);
    console.log(`   numeroBanco: ${JSON.stringify(primeiraConta.numeroBanco)}`);

    // ETAPA 2: Buscar detalhe
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📋 ETAPA 2: DADOS DO DETALHE');
    console.log('═══════════════════════════════════════════════════════════\n');

    const contaId = primeiraConta.id;
    
    await new Promise(r => setTimeout(r, 300));
    
    const respDetalhe = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-pagar/${contaId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!respDetalhe.ok) {
      console.error(`❌ Erro no detalhe: ${respDetalhe.status}`);
      return;
    }

    const detalhe = await respDetalhe.json();
    
    console.log(`🔎 Detalhe da conta ${contaId}:\n`);
    console.log('Campos principais:');
    console.log(`   fornecedor/cliente: ${JSON.stringify(detalhe.cliente || detalhe.fornecedor)}`);
    console.log(`   categoria: ${JSON.stringify(detalhe.categoria)}`);
    console.log(`   centroCusto: ${JSON.stringify(detalhe.centroCusto || detalhe.centro_custo)}`);
    console.log(`   formaPagamento: ${JSON.stringify(detalhe.formaPagamento || detalhe.forma_pagamento)}`);
    console.log(`   contaBancaria: ${JSON.stringify(detalhe.contaBancaria || detalhe.conta_bancaria)}`);
    console.log(`   numeroBanco: ${JSON.stringify(detalhe.numeroBanco)}`);

    console.log('\n\n📄 JSON COMPLETO DO DETALHE:\n');
    console.log(JSON.stringify(detalhe, null, 2));

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  🎯 ANÁLISE                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('Baseado no que foi descoberto em "Contas Recebidas":');
    console.log('   • Se formaPagamento for OBJETO {id, nome} → extrair nome');
    console.log('   • Se categoria for OBJETO {id, descricao/nome} → extrair descricao');
    console.log('   • Se centroCusto for OBJETO {id, nome} → extrair nome');
    console.log('   • contaBancaria pode não existir (foi o caso em Recebidas)\n');

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

investigar().catch(console.error);
