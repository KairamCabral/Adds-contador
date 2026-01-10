/**
 * BUSCA RECURSIVA: Procurar QUALQUER campo relacionado a banco/destino
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

function buscarCamposRecursivo(obj, prefixo = '', profundidade = 0) {
  const resultados = [];
  
  if (profundidade > 10 || !obj || typeof obj !== 'object') {
    return resultados;
  }
  
  for (const [chave, valor] of Object.entries(obj)) {
    const caminhoCompleto = prefixo ? `${prefixo}.${chave}` : chave;
    
    // Palavras-chave relacionadas a banco/destino
    const palavrasChave = [
      'banco', 'conta', 'destino', 'receb', 'pagam', 
      'caixa', 'corrente', 'deposit', 'transfer'
    ];
    
    const chaveNormalizada = chave.toLowerCase();
    const temPalavraChave = palavrasChave.some(p => chaveNormalizada.includes(p));
    
    if (temPalavraChave) {
      resultados.push({
        caminho: caminhoCompleto,
        valor: JSON.stringify(valor).substring(0, 100)
      });
    }
    
    // Continuar busca recursiva
    if (typeof valor === 'object' && valor !== null) {
      resultados.push(...buscarCamposRecursivo(valor, caminhoCompleto, profundidade + 1));
    }
  }
  
  return resultados;
}

async function investigar() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 BUSCA RECURSIVA: Campos relacionados a BANCO/DESTINO    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // Buscar na API de LISTAGEM (não detalhe)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 ANALISANDO API DE LISTAGEM');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const respLista = await fetch(
      'https://erp.tiny.com.br/public-api/v3/contas-receber?situacao=pago&dataInicial=2026-01-01&limite=1',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (respLista.ok) {
      const lista = await respLista.json();
      
      if (lista.itens && lista.itens.length > 0) {
        const primeiraConta = lista.itens[0];
        
        console.log('🔎 Primeira conta da lista:');
        console.log(`   ID: ${primeiraConta.id}`);
        console.log(`   Cliente: ${primeiraConta.cliente?.nome || 'N/A'}\n`);
        
        console.log('📋 Campos relacionados a BANCO/DESTINO encontrados:\n');
        
        const camposEncontrados = buscarCamposRecursivo(primeiraConta);
        
        if (camposEncontrados.length > 0) {
          camposEncontrados.forEach(({ caminho, valor }) => {
            console.log(`   ✅ ${caminho}`);
            console.log(`      → ${valor}\n`);
          });
        } else {
          console.log('   ❌ Nenhum campo encontrado\n');
        }
        
        console.log('📄 JSON COMPLETO da primeira conta:');
        console.log(JSON.stringify(primeiraConta, null, 2));
      }
    }

    // Buscar no DETALHE
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('📋 ANALISANDO API DE DETALHE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const contaId = 914763106;
    
    const respDetalhe = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber/${contaId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (respDetalhe.ok) {
      const detalhe = await respDetalhe.json();
      
      console.log('🔎 Detalhe da conta:');
      console.log(`   ID: ${detalhe.id}\n`);
      
      console.log('📋 Campos relacionados a BANCO/DESTINO encontrados:\n');
      
      const camposEncontrados = buscarCamposRecursivo(detalhe);
      
      if (camposEncontrados.length > 0) {
        camposEncontrados.forEach(({ caminho, valor }) => {
          console.log(`   ✅ ${caminho}`);
          console.log(`      → ${valor}\n`);
        });
      } else {
        console.log('   ❌ Nenhum campo encontrado\n');
      }
    }

    // CONCLUSÃO FINAL
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🎯 CONCLUSÃO                                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('Se não encontrou campos de destino em lugar nenhum:');
    console.log('   → A API Tiny NÃO fornece informação de conta bancária de destino');
    console.log('   → Apenas fornece a FORMA de recebimento (Boleto, PIX, etc.)');
    console.log('   → Limitação da API, não há solução técnica possível\n');
    console.log('Se encontrou:');
    console.log('   → Verificar se é possível mapear para nome da conta\n');

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

investigar().catch(console.error);
