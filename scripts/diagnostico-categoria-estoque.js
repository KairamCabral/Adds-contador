/**
 * scripts/diagnostico-categoria-estoque.js
 * Investigar por que categoria não está sendo extraída
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

async function diagnosticar() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🔍 DIAGNÓSTICO: Categoria do Estoque                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // COMPARAR: Lista vs. Detalhe
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 COMPARAÇÃO: LISTA vs. DETALHE');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar da LISTA
    const respLista = await fetch(
      'https://erp.tiny.com.br/public-api/v3/produtos?limite=1',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!respLista.ok) {
      console.error(`❌ Erro na lista: ${respLista.status}`);
      return;
    }

    const lista = await respLista.json();
    
    if (!lista.itens || lista.itens.length === 0) {
      console.log('⚠️  Nenhum produto na lista');
      return;
    }

    const produtoLista = lista.itens[0];
    const idProduto = produtoLista.id;
    
    console.log('📦 PRODUTO DA LISTA:');
    console.log(`   ID: ${idProduto}`);
    console.log(`   Nome: ${produtoLista.nome || produtoLista.descricao}`);
    console.log(`\n   Categoria na lista:`);
    console.log(`   ${JSON.stringify(produtoLista.categoria, null, 2)}`);
    
    // Buscar DETALHE
    await new Promise(r => setTimeout(r, 300));

    const respDetalhe = await fetch(
      `https://erp.tiny.com.br/public-api/v3/produtos/${idProduto}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!respDetalhe.ok) {
      console.error(`❌ Erro no detalhe: ${respDetalhe.status}`);
      return;
    }

    const produtoDetalhe = await respDetalhe.json();
    
    console.log(`\n📦 PRODUTO DO DETALHE:`);
    console.log(`\n   Categoria no detalhe:`);
    console.log(`   ${JSON.stringify(produtoDetalhe.categoria, null, 2)}`);

    // ANÁLISE
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('🔍 ANÁLISE');
    console.log('═══════════════════════════════════════════════════════════\n');

    const categoriaLista = produtoLista.categoria;
    const categoriaDetalhe = produtoDetalhe.categoria;

    if (!categoriaLista && categoriaDetalhe) {
      console.log('❌ PROBLEMA IDENTIFICADO:');
      console.log('   → Categoria NÃO vem na lista');
      console.log('   → Categoria SÓ vem no detalhe\n');
      console.log('✅ SOLUÇÃO:');
      console.log('   → Implementar ENRICHMENT');
      console.log('   → Buscar /produtos/{id} para cada produto');
      console.log('   → Similar ao que fizemos em Contas Pagas/Recebidas\n');
    } else if (categoriaLista && categoriaDetalhe) {
      console.log('✅ Categoria disponível em ambos');
      
      if (typeof categoriaLista === 'string') {
        console.log('   → Lista: STRING');
      } else if (typeof categoriaLista === 'object') {
        console.log('   → Lista: OBJETO');
        console.log(`      Campo a extrair: ${categoriaLista.nome ? 'nome' : categoriaLista.descricao ? 'descricao' : '?'}`);
      }
      
      if (typeof categoriaDetalhe === 'object') {
        console.log('   → Detalhe: OBJETO');
        console.log(`      Campo a extrair: ${categoriaDetalhe.nome ? 'nome' : '?'}`);
      }
    }

    // Testar transformer atual
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🧪 TESTE DO TRANSFORMER ATUAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Simular extração atual
    function safeGet(obj, path) {
      try {
        return path.reduce((acc, key) => acc?.[key], obj);
      } catch {
        return undefined;
      }
    }

    function safeText(val) {
      if (!val) return "-";
      if (typeof val === 'string') return val.trim() || "-";
      return String(val);
    }

    const categoriaExtraida = safeText(safeGet(produtoLista, ["categoria", "nome"]));
    
    console.log(`Categoria extraída da LISTA: "${categoriaExtraida}"`);
    
    if (categoriaExtraida === "-" || categoriaExtraida === "undefined") {
      console.log('❌ FALHA: Não conseguiu extrair da lista');
      console.log('✅ NECESSÁRIO: Buscar detalhe do produto\n');
    } else {
      console.log('✅ SUCESSO: Extraiu da lista');
      console.log('⚠️  MAS: Verificar se sempre funciona\n');
    }

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosticar().catch(console.error);
