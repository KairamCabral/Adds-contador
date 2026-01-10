/**
 * scripts/validar-transformer-contas-pagas.js
 * Valida o transformer com dados reais da API
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

// Simular o transformer localmente
function transformContaPagaLocal(companyId, contaObj) {
  if (contaObj.situacao !== "pago") {
    return null;
  }

  // Fornecedor (preferir contato do detalhe)
  const fornecedorNome = contaObj.contato?.nome 
    || contaObj.cliente?.nome 
    || contaObj.fornecedor?.nome;
  const fornecedor = fornecedorNome?.trim() || "N/D";
  
  // Categoria (objeto no detalhe)
  let categoria = "N/D";
  if (typeof contaObj.categoria === 'object' && contaObj.categoria) {
    categoria = contaObj.categoria.descricao || contaObj.categoria.nome || "N/D";
  } else if (typeof contaObj.categoria === 'string') {
    categoria = contaObj.categoria.trim() || "N/D";
  }
  
  // Forma de Pagamento (objeto no detalhe)
  let formaPagamento = "N/D";
  const formaPgtoObj = contaObj.formaPagamento || contaObj.forma_pagamento;
  if (typeof formaPgtoObj === 'object' && formaPgtoObj) {
    formaPagamento = formaPgtoObj.nome?.trim() || "N/D";
  } else if (typeof formaPgtoObj === 'string') {
    formaPagamento = formaPgtoObj.trim() || "N/D";
  }
  
  // Centro de Custo
  let centroCusto = null;
  const centroCustoObj = contaObj.centroCusto || contaObj.centro_custo;
  if (typeof centroCustoObj === 'object' && centroCustoObj) {
    centroCusto = centroCustoObj.nome?.trim() || null;
  } else if (typeof centroCustoObj === 'string') {
    centroCusto = centroCustoObj.trim() || null;
  }
  
  // Conta Bancária (não existe)
  const contaBancaria = "N/D";
  
  return {
    tituloId: contaObj.id,
    fornecedor,
    categoria,
    centroCusto,
    formaPagamento,
    contaBancaria,
    valorPago: contaObj.valorPago || contaObj.valor_pago || contaObj.valor,
  };
}

async function validar() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ VALIDAÇÃO: Transformer Contas Pagas                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const company = await prisma.company.findFirst();
    const accessToken = decrypt(connection.accessTokenEnc);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 BUSCANDO CONTAS PAGAS DA API');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar 3 contas pagas
    const respLista = await fetch(
      'https://erp.tiny.com.br/public-api/v3/contas-pagar?situacao=pago&dataInicial=2026-01-01&limite=3',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!respLista.ok) {
      console.error(`❌ Erro na API: ${respLista.status}`);
      return;
    }

    const lista = await respLista.json();
    
    if (!lista.itens || lista.itens.length === 0) {
      console.log('⚠️  Nenhuma conta paga encontrada');
      return;
    }

    console.log(`✅ Encontradas ${lista.itens.length} contas pagas\n`);

    // Buscar detalhe e transformar cada uma
    for (let i = 0; i < Math.min(lista.itens.length, 3); i++) {
      const conta = lista.itens[i];
      
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`📋 CONTA ${i + 1}/${lista.itens.length} - ID: ${conta.id}`);
      console.log(`═══════════════════════════════════════════════════════════\n`);
      
      // Buscar detalhe
      await new Promise(r => setTimeout(r, 300));
      
      const respDetalhe = await fetch(
        `https://erp.tiny.com.br/public-api/v3/contas-pagar/${conta.id}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!respDetalhe.ok) {
        console.error(`   ❌ Erro ao buscar detalhe: ${respDetalhe.status}\n`);
        continue;
      }

      const detalhe = await respDetalhe.json();
      
      // Transformar
      const transformed = transformContaPagaLocal(company.id, detalhe);
      
      if (!transformed) {
        console.log('   ⚠️  Conta não processada (situação != pago)\n');
        continue;
      }
      
      // Mostrar resultado
      console.log('✅ TRANSFORMAÇÃO:');
      console.log(`   Fornecedor: ${transformed.fornecedor}`);
      console.log(`   Categoria: ${transformed.categoria}`);
      console.log(`   Centro Custo: ${transformed.centroCusto || '(null)'}`);
      console.log(`   Forma Pagamento: ${transformed.formaPagamento}`);
      console.log(`   Conta Bancária: ${transformed.contaBancaria}`);
      console.log(`   Valor Pago: R$ ${transformed.valorPago}`);
      console.log();
      
      // Validação
      const issues = [];
      if (transformed.fornecedor === 'N/D') issues.push('Fornecedor N/D');
      if (transformed.categoria === 'N/D') issues.push('Categoria N/D');
      if (transformed.formaPagamento === 'N/D') issues.push('Forma Pagamento N/D');
      
      if (issues.length > 0) {
        console.log(`   ⚠️  Problemas: ${issues.join(', ')}`);
      } else {
        console.log('   ✅ Todos os campos principais preenchidos!');
      }
      console.log();
    }

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ VALIDAÇÃO CONCLUÍDA                                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('📌 Campos esperados:');
    console.log('   ✅ Fornecedor: Preenchido com nome do contato');
    console.log('   ✅ Categoria: Preenchido com descrição da categoria');
    console.log('   ✅ Forma Pagamento: Preenchido com nome (Pix, Boleto, etc.)');
    console.log('   ⚠️  Centro Custo: null (não existe na API)');
    console.log('   ⚠️  Conta Bancária: "N/D" (limitação da API)\n');

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

validar().catch(console.error);
