/**
 * DEBUG: Investigar diretamente API Tiny para contas recebidas
 * Objetivo: Ver exatamente o que a API retorna para forma pagamento e conta bancária
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAPI() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔬 DEBUG: API TINY - CONTAS RECEBIDAS                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Buscar connection
    console.log('🔍 Buscando conexão ativa...');
    const connection = await prisma.tinyConnection.findFirst({
      where: { company: { name: { not: 'test' } } },
      include: { company: true }
    });

    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Conexão encontrada: ${connection.company.name}\n`);

    // 2. Buscar contas recebidas do banco
    console.log('📊 Buscando contas recebidas no banco...');
    const contasRecebidas = await prisma.vwContasRecebidas.findMany({
      take: 3,
      orderBy: { dataRecebimento: 'desc' }
    });

    console.log(`✅ Encontradas ${contasRecebidas.length} contas no banco\n`);

    if (contasRecebidas.length === 0) {
      console.log('⚠️  Nenhuma conta encontrada. Execute uma sincronização primeiro.\n');
      await prisma.$disconnect();
      return;
    }

    // 3. Para cada conta, buscar detalhe na API
    const { getContaReceberDetalhe } = require('../lib/tiny/api');
    const { decrypt } = require('../lib/crypto');

    const decryptedConnection = {
      ...connection,
      accessToken: decrypt(connection.accessTokenEnc),
      refreshToken: decrypt(connection.refreshTokenEnc),
    };

    console.log('════════════════════════════════════════════════════════════════\n');

    for (let i = 0; i < contasRecebidas.length; i++) {
      const conta = contasRecebidas[i];
      
      console.log(`🔬 TESTE ${i + 1}/${contasRecebidas.length}`);
      console.log(`   ID Título: ${conta.tituloId}`);
      console.log(`   Cliente: ${conta.cliente}`);
      console.log(`\n   📋 DADOS NO BANCO (atual):`);
      console.log(`   - Forma Recebimento: "${conta.formaRecebimento}"`);
      console.log(`   - Conta Bancária: "${conta.contaBancaria}"`);
      
      try {
        // Delay para evitar rate limit
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const detalhe = await getContaReceberDetalhe(decryptedConnection, Number(conta.tituloId));
        
        console.log(`\n   🔍 DETALHE DA API (estrutura completa):`);
        console.log(JSON.stringify(detalhe, null, 2));
        
        console.log(`\n   ✅ ANÁLISE DE CAMPOS ESPECÍFICOS:`);
        
        // Forma Pagamento
        console.log('\n   💳 FORMA PAGAMENTO:');
        const camposFormaPagto = [
          'formaPagamento', 'forma_pagamento',
          'meioPagamento', 'meio_pagamento',
          'tipoPagamento', 'tipo_pagamento'
        ];
        let encontrouFormaPagto = false;
        for (const campo of camposFormaPagto) {
          if (detalhe[campo] !== undefined) {
            console.log(`      ✅ ${campo}: ${JSON.stringify(detalhe[campo])}`);
            console.log(`         typeof: ${typeof detalhe[campo]}`);
            if (typeof detalhe[campo] === 'object' && detalhe[campo]) {
              console.log(`         .nome: ${detalhe[campo].nome}`);
              console.log(`         .descricao: ${detalhe[campo].descricao}`);
            }
            encontrouFormaPagto = true;
          }
        }
        if (!encontrouFormaPagto) {
          console.log('      ❌ Nenhum campo encontrado');
        }
        
        // Conta Bancária
        console.log('\n   🏦 CONTA BANCÁRIA:');
        const camposContaBanc = [
          'contaBancaria', 'conta_bancaria',
          'banco', 'nomeBanco', 'nome_banco',
          'contaRecebimento', 'conta_recebimento'
        ];
        let encontrouContaBanc = false;
        for (const campo of camposContaBanc) {
          if (detalhe[campo] !== undefined) {
            console.log(`      ✅ ${campo}: ${JSON.stringify(detalhe[campo])}`);
            console.log(`         typeof: ${typeof detalhe[campo]}`);
            if (typeof detalhe[campo] === 'object' && detalhe[campo]) {
              console.log(`         .nome: ${detalhe[campo].nome}`);
              console.log(`         .descricao: ${detalhe[campo].descricao}`);
            }
            encontrouContaBanc = true;
          }
        }
        if (!encontrouContaBanc) {
          console.log('      ❌ Nenhum campo encontrado');
        }

        // Todos os campos (para descobrir o que existe)
        console.log('\n   📋 TODOS OS CAMPOS RETORNADOS PELA API:');
        Object.keys(detalhe).forEach(key => {
          const value = detalhe[key];
          const tipo = typeof value;
          const preview = tipo === 'object' 
            ? JSON.stringify(value).substring(0, 50) 
            : JSON.stringify(value).substring(0, 30);
          console.log(`      - ${key} (${tipo}): ${preview}...`);
        });
        
      } catch (err) {
        console.error(`\n   ❌ Erro ao buscar detalhe: ${err.message}`);
      }
      
      console.log('\n════════════════════════════════════════════════════════════════\n');
    }

  } catch (err) {
    console.error('❌ Erro geral:', err);
  } finally {
    await prisma.$disconnect();
  }
}

debugAPI().catch(console.error);
