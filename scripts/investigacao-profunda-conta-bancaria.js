/**
 * INVESTIGAÇÃO PROFUNDA: Conta Bancária
 * Objetivo: Descobrir se conta bancária existe em algum lugar da API Tiny
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

// Buscar recursivamente em objetos aninhados
function buscarCamposAninhados(obj, prefixo = '', nivel = 0) {
  if (nivel > 5) return []; // Evitar recursão infinita
  
  const resultados = [];
  
  if (!obj || typeof obj !== 'object') return resultados;
  
  for (const [key, value] of Object.entries(obj)) {
    const caminho = prefixo ? `${prefixo}.${key}` : key;
    const tipo = Array.isArray(value) ? 'array' : typeof value;
    
    let preview = '';
    if (tipo === 'object') {
      preview = JSON.stringify(value).substring(0, 100);
    } else if (tipo === 'array') {
      preview = `[${value.length} items]`;
    } else {
      preview = String(value).substring(0, 60);
    }
    
    resultados.push({ caminho, tipo, valor: value, preview });
    
    // Recursão para objetos
    if (tipo === 'object' && value !== null) {
      resultados.push(...buscarCamposAninhados(value, caminho, nivel + 1));
    }
  }
  
  return resultados;
}

async function investigar() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔬 INVESTIGAÇÃO PROFUNDA: CONTA BANCÁRIA                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // ETAPA 1: Analisar detalhes de contas recebidas
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 ETAPA 1: ANALISAR DETALHES DE CONTAS RECEBIDAS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const contas = await prisma.vwContasRecebidas.findMany({
      orderBy: { dataRecebimento: 'desc' },
      take: 2
    });

    if (contas.length === 0) {
      console.log('⚠️  Nenhuma conta encontrada\n');
      return;
    }

    let encontrouContaBancaria = false;
    const camposPossiveis = new Set();

    for (let i = 0; i < contas.length; i++) {
      const conta = contas[i];
      
      console.log(`🔍 Analisando conta ${i + 1}/${contas.length}`);
      console.log(`   ID: ${conta.tituloId}`);
      console.log(`   Cliente: ${conta.cliente}\n`);

      if (i > 0) await new Promise(r => setTimeout(r, 500));

      const response = await fetch(
        `https://erp.tiny.com.br/public-api/v3/contas-receber/${conta.tituloId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        console.log(`   ❌ Erro HTTP ${response.status}\n`);
        continue;
      }

      const data = await response.json();
      const todosCampos = buscarCamposAninhados(data);
      
      // Procurar padrões relacionados a banco
      const padroes = ['banco', 'banc', 'conta', 'agencia', 'deposit', 'liquidacao', 'destino', 'credito', 'receb'];
      const relevantes = todosCampos.filter(c => {
        const baixo = c.caminho.toLowerCase();
        return padroes.some(p => baixo.includes(p));
      });

      if (relevantes.length > 0) {
        console.log('   ✅ Campos potenciais encontrados:\n');
        relevantes.forEach(campo => {
          console.log(`      • ${campo.caminho} (${campo.tipo}): ${campo.preview}`);
          camposPossiveis.add(campo.caminho);
        });
        encontrouContaBancaria = true;
      } else {
        console.log('   ❌ Nenhum campo relacionado a banco encontrado');
      }
      console.log();
    }

    // ETAPA 2: Tentar endpoint de contas bancárias
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🏦 ETAPA 2: TESTAR ENDPOINT DE CONTAS BANCÁRIAS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const endpointsTeste = [
      '/contas-bancarias',
      '/bancos',
      '/formas-recebimento',
      '/formas-pagamento',
      '/contas-correntes',
    ];

    for (const endpoint of endpointsTeste) {
      console.log(`🔎 Testando: ${endpoint}`);
      
      try {
        const resp = await fetch(
          `https://erp.tiny.com.br/public-api/v3${endpoint}`,
          { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        console.log(`   Status: ${resp.status} ${resp.statusText}`);
        
        if (resp.ok) {
          const dados = await resp.json();
          console.log(`   ✅ ENDPOINT EXISTE!`);
          console.log(`   Estrutura: ${JSON.stringify(dados).substring(0, 200)}...\n`);
          
          // Se for lista, pegar detalhes do primeiro item
          if (dados.itens && dados.itens.length > 0) {
            console.log(`   📋 Primeiro item:`);
            console.log(JSON.stringify(dados.itens[0], null, 2).substring(0, 500));
          }
        } else if (resp.status === 404) {
          console.log(`   ❌ Endpoint não existe`);
        } else {
          const erro = await resp.text();
          console.log(`   ⚠️  Erro: ${erro.substring(0, 100)}`);
        }
      } catch (err) {
        console.log(`   ❌ Erro: ${err.message}`);
      }
      console.log();
    }

    // ETAPA 3: Verificar se formaRecebimento tem link com conta bancária
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔗 ETAPA 3: VERIFICAR LINK FORMA RECEBIMENTO → CONTA BANCÁRIA');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const primeiraContaComForma = contas.find(c => c.formaRecebimento !== 'N/D');
    if (primeiraContaComForma) {
      console.log(`📋 Usando conta ID ${primeiraContaComForma.tituloId}`);
      console.log(`   Forma Recebimento: ${primeiraContaComForma.formaRecebimento}\n`);

      // Buscar detalhe para pegar ID da forma
      const respConta = await fetch(
        `https://erp.tiny.com.br/public-api/v3/contas-receber/${primeiraContaComForma.tituloId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (respConta.ok) {
        const detalheConta = await respConta.json();
        const formaRecebimentoId = detalheConta.formaRecebimento?.id;
        
        if (formaRecebimentoId) {
          console.log(`   ID da Forma: ${formaRecebimentoId}\n`);
          console.log(`   🔎 Tentando buscar detalhe: /formas-recebimento/${formaRecebimentoId}\n`);

          const respForma = await fetch(
            `https://erp.tiny.com.br/public-api/v3/formas-recebimento/${formaRecebimentoId}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          console.log(`   Status: ${respForma.status} ${respForma.statusText}`);
          
          if (respForma.ok) {
            const detalheForma = await respForma.json();
            console.log(`   ✅ DETALHE DA FORMA:\n`);
            console.log(JSON.stringify(detalheForma, null, 2));
          } else {
            console.log(`   ❌ Endpoint não existe ou erro`);
          }
        }
      }
    } else {
      console.log('⚠️  Nenhuma conta com forma de recebimento válida encontrada');
    }

    // RESUMO FINAL
    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🎯 CONCLUSÃO                                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (encontrouContaBancaria) {
      console.log('✅ CAMPOS RELACIONADOS A BANCO ENCONTRADOS!\n');
      console.log('   Campos possíveis:');
      camposPossiveis.forEach(campo => console.log(`   • ${campo}`));
      console.log('\n   → PRÓXIMO PASSO: Atualizar transformer para usar esses campos');
    } else {
      console.log('❌ NENHUM campo de conta bancária encontrado em contas-receber\n');
      console.log('   Possíveis razões:');
      console.log('   1. Tiny ERP não registra conta bancária em contas a receber');
      console.log('   2. Informação está em endpoint separado (testado acima)');
      console.log('   3. Campo não é obrigatório no Tiny e clientes não preenchem\n');
      console.log('   → RECOMENDAÇÃO: Manter campo como "N/D" ou criar cadastro manual');
    }

    console.log('\n');

  } catch (err) {
    console.error('❌ Erro geral:', err);
  } finally {
    await prisma.$disconnect();
  }
}

investigar().catch(console.error);
