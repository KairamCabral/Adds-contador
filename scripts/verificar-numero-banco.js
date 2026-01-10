/**
 * VERIFICAR: Campo numeroBanco existe na API?
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

async function verificar() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 VERIFICANDO: Campo numeroBanco                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // Testar nos 2 endpoints
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🔎 TESTE 1: Endpoint de LISTAGEM /contas-receber\n');
    
    const hoje = new Date().toISOString().split('T')[0];
    const umMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const respLista = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber?dataInicial=${umMesAtras}&dataFinal=${hoje}&situacao=pago&pagina=1`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (respLista.ok) {
      const dataLista = await respLista.json();
      const contas = dataLista.itens || [];
      
      console.log(`✅ Encontradas ${contas.length} contas na lista\n`);
      
      if (contas.length > 0) {
        const conta = contas[0];
        console.log('📋 Primeira conta da lista:');
        console.log(`   ID: ${conta.id}`);
        console.log(`   Cliente: ${conta.cliente?.nome}`);
        console.log('\n   🔍 Verificando campo numeroBanco:');
        
        if (conta.numeroBanco !== undefined) {
          console.log(`   ✅ numeroBanco EXISTE: "${conta.numeroBanco}"`);
          console.log(`      Tipo: ${typeof conta.numeroBanco}`);
        } else {
          console.log('   ❌ numeroBanco NÃO EXISTE na lista');
        }
        
        // Verificar todos os campos que contêm "banco"
        console.log('\n   📋 Todos os campos com "banco":');
        Object.keys(conta).forEach(key => {
          if (key.toLowerCase().includes('banco')) {
            console.log(`      • ${key}: ${JSON.stringify(conta[key])}`);
          }
        });
        
        // Testar no DETALHE
        console.log('\n\n═══════════════════════════════════════════════════════════════');
        console.log(`🔎 TESTE 2: Endpoint de DETALHE /contas-receber/${conta.id}\n`);
        
        await new Promise(r => setTimeout(r, 500));
        
        const respDetalhe = await fetch(
          `https://erp.tiny.com.br/public-api/v3/contas-receber/${conta.id}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (respDetalhe.ok) {
          const dataDetalhe = await respDetalhe.json();
          
          console.log('   🔍 Verificando campo numeroBanco no detalhe:');
          
          if (dataDetalhe.numeroBanco !== undefined) {
            console.log(`   ✅ numeroBanco EXISTE: "${dataDetalhe.numeroBanco}"`);
            console.log(`      Tipo: ${typeof dataDetalhe.numeroBanco}`);
          } else {
            console.log('   ❌ numeroBanco NÃO EXISTE no detalhe');
          }
          
          // Verificar todos os campos que contêm "banco"
          console.log('\n   📋 Todos os campos com "banco" no detalhe:');
          Object.keys(dataDetalhe).forEach(key => {
            if (key.toLowerCase().includes('banco')) {
              console.log(`      • ${key}: ${JSON.stringify(dataDetalhe[key])}`);
            }
          });
          
          // Mostrar estrutura completa se tiver numeroBanco
          if (dataDetalhe.numeroBanco !== undefined) {
            console.log('\n   📄 JSON COMPLETO da conta:');
            console.log(JSON.stringify(dataDetalhe, null, 2));
          }
        }
      }
    } else {
      console.log(`❌ Erro na listagem: ${respLista.status}`);
    }

    // CONCLUSÃO
    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🎯 CONCLUSÃO                                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('Se numeroBanco EXISTE:');
    console.log('   ✅ Podemos usar para mostrar informação de banco');
    console.log('   ✅ Atualizar transformer para extrair esse campo\n');
    console.log('Se numeroBanco NÃO EXISTE:');
    console.log('   ⚠️  Documentação pode estar desatualizada');
    console.log('   ⚠️  Campo pode ser só para contas abertas (não recebidas)\n');

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verificar().catch(console.error);
