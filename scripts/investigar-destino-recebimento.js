/**
 * INVESTIGAR: Destino do recebimento (conta bancária da empresa)
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
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 INVESTIGAR: DESTINO do Recebimento (Conta da Empresa)   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // ETAPA 1: Buscar conta com numeroBanco preenchido
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 ETAPA 1: ANALISAR CONTA COM numeroBanco');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const contaId = 914763106; // Ricardo Pegoraro que tem numeroBanco="5935495"
    
    console.log(`🔎 Buscando detalhe da conta ${contaId}...\n`);

    const respDetalhe = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber/${contaId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (respDetalhe.ok) {
      const detalhe = await respDetalhe.json();
      
      console.log('✅ Detalhe obtido. Procurando campos relacionados a DESTINO/BANCO:\n');
      
      const camposRelevantes = [
        'destino', 'contaDestino', 'conta_destino',
        'banco', 'numeroBanco', 'numero_banco',
        'contaBancaria', 'conta_bancaria',
        'contaBancariaDestino', 'conta_bancaria_destino',
        'contaRecebimento', 'conta_recebimento',
        'contaCorrente', 'conta_corrente'
      ];
      
      let encontrou = false;
      camposRelevantes.forEach(campo => {
        if (detalhe[campo] !== undefined) {
          console.log(`   ✅ ${campo}: ${JSON.stringify(detalhe[campo])}`);
          encontrou = true;
        }
      });
      
      if (!encontrou) {
        console.log('   ❌ Nenhum campo de destino encontrado no detalhe');
      }
      
      // Mostrar JSON completo para análise
      console.log('\n   📄 JSON COMPLETO (primeiros 1500 chars):');
      console.log(JSON.stringify(detalhe, null, 2).substring(0, 1500));
    }

    // ETAPA 2: Verificar se numeroBanco é ID para buscar em outro endpoint
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('🔗 ETAPA 2: TENTAR MAPEAR numeroBanco → Nome do Banco');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const numeroBanco = "5935495";
    console.log(`📌 numeroBanco encontrado: ${numeroBanco}\n`);
    console.log('🔎 Testando endpoints para buscar detalhes:\n');

    const endpointsTeste = [
      `/bancos/${numeroBanco}`,
      `/contas-bancarias/${numeroBanco}`,
      `/contas-correntes/${numeroBanco}`,
      `/contas/${numeroBanco}`,
    ];

    for (const endpoint of endpointsTeste) {
      console.log(`   Tentando: ${endpoint}`);
      
      try {
        const resp = await fetch(
          `https://erp.tiny.com.br/public-api/v3${endpoint}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (resp.ok) {
          const dados = await resp.json();
          console.log(`   ✅ SUCESSO! Dados encontrados:`);
          console.log(JSON.stringify(dados, null, 2).substring(0, 300));
        } else {
          console.log(`   ❌ ${resp.status}`);
        }
      } catch (err) {
        console.log(`   ❌ Erro: ${err.message.substring(0, 50)}`);
      }
      
      await new Promise(r => setTimeout(r, 300));
    }

    // ETAPA 3: Listar todas as contas bancárias cadastradas
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('🏦 ETAPA 3: LISTAR CONTAS BANCÁRIAS DA EMPRESA');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const endpointsLista = [
      '/bancos',
      '/contas-bancarias', 
      '/contas-correntes',
      '/contas',
      '/contas-empresa'
    ];

    for (const endpoint of endpointsLista) {
      console.log(`🔎 Tentando: ${endpoint}`);
      
      try {
        const resp = await fetch(
          `https://erp.tiny.com.br/public-api/v3${endpoint}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (resp.ok) {
          const dados = await resp.json();
          console.log(`   ✅ ENDPOINT EXISTE!`);
          console.log(`   Estrutura: ${JSON.stringify(dados).substring(0, 200)}...\n`);
          
          // Mostrar primeiros itens
          if (dados.itens && Array.isArray(dados.itens)) {
            console.log(`   📋 Total de contas: ${dados.itens.length}`);
            console.log(`   Primeiras 5 contas:\n`);
            dados.itens.slice(0, 5).forEach((conta, i) => {
              console.log(`   ${i + 1}. ID: ${conta.id}`);
              console.log(`      Nome: ${conta.nome || conta.descricao || 'N/A'}`);
              console.log(`      Tipo: ${conta.tipo || 'N/A'}\n`);
            });
            
            // Procurar se alguma tem ID = numeroBanco
            const contaEncontrada = dados.itens.find(c => c.id == numeroBanco);
            if (contaEncontrada) {
              console.log(`   🎯 ENCONTROU! Conta com ID ${numeroBanco}:`);
              console.log(JSON.stringify(contaEncontrada, null, 2));
            }
          }
        } else {
          console.log(`   ❌ ${resp.status} - Não existe`);
        }
      } catch (err) {
        console.log(`   ❌ Erro: ${err.message.substring(0, 50)}`);
      }
      
      console.log();
      await new Promise(r => setTimeout(r, 300));
    }

    // CONCLUSÃO
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🎯 PRÓXIMOS PASSOS                                          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('Se encontrou endpoint de contas bancárias:');
    console.log('   1. Guardar mapeamento ID → Nome da conta');
    console.log('   2. Na sincronização, buscar nome da conta pelo numeroBanco');
    console.log('   3. Mostrar "Banco do Brasil" em vez de "5935495"\n');
    console.log('Se não encontrou:');
    console.log('   1. Campo pode estar em outro lugar do JSON');
    console.log('   2. Verificar se há campo "contaBancaria" como objeto\n');

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

investigar().catch(console.error);
