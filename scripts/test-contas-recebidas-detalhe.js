/**
 * Script de teste para contas recebidas - busca detalhe da API
 * Valida se categoria, forma pagamento e conta bancária estão disponíveis no endpoint de detalhe
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testContaRecebidaDetalhe() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 TESTE: CONTAS RECEBIDAS - ENDPOINT DETALHE              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Buscar uma connection ativa
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
      take: 5,
      orderBy: { dataRecebimento: 'desc' }
    });

    console.log(`✅ Encontradas ${contasRecebidas.length} contas recebidas no banco\n`);

    if (contasRecebidas.length === 0) {
      console.log('⚠️  Nenhuma conta recebida encontrada. Execute uma sincronização primeiro.');
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

    let totalTested = 0;
    let totalWithCategoria = 0;
    let totalWithFormaPagto = 0;
    let totalWithContaBanc = 0;

    for (const conta of contasRecebidas) {
      console.log(`🔍 TESTE ${totalTested + 1}/${contasRecebidas.length}`);
      console.log(`   ID Título: ${conta.tituloId}`);
      console.log(`   Cliente: ${conta.cliente}`);
      console.log(`   Valor: R$ ${conta.valorRecebido}`);
      console.log(`\n   📋 DADOS NO BANCO (atual):`);
      console.log(`   - Categoria: ${conta.categoria}`);
      console.log(`   - Centro Custo: ${conta.centroCusto || '(vazio)'}`);
      console.log(`   - Forma Recebimento: ${conta.formaRecebimento}`);
      console.log(`   - Conta Bancária: ${conta.contaBancaria}`);
      
      try {
        // Delay para evitar rate limit
        if (totalTested > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const detalhe = await getContaReceberDetalhe(decryptedConnection, Number(conta.tituloId));
        
        console.log(`\n   ✅ DADOS DA API (detalhe):`);
        
        // Categoria
        if (detalhe.categoria) {
          console.log(`   - categoria: ✅ ${JSON.stringify(detalhe.categoria)}`);
          totalWithCategoria++;
        } else {
          console.log(`   - categoria: ❌ null`);
        }
        
        // Centro Custo
        if (detalhe.centroCusto !== undefined) {
          console.log(`   - centroCusto: ${JSON.stringify(detalhe.centroCusto)}`);
        } else {
          console.log(`   - centroCusto: ⚠️  campo não existe`);
        }
        
        // Forma Pagamento
        if (detalhe.formaPagamento || detalhe.forma_pagamento) {
          console.log(`   - formaPagamento: ✅ ${JSON.stringify(detalhe.formaPagamento || detalhe.forma_pagamento)}`);
          totalWithFormaPagto++;
        } else {
          console.log(`   - formaPagamento: ❌ null`);
        }
        
        // Conta Bancária
        if (detalhe.contaBancaria || detalhe.conta_bancaria) {
          console.log(`   - contaBancaria: ✅ ${JSON.stringify(detalhe.contaBancaria || detalhe.conta_bancaria)}`);
          totalWithContaBanc++;
        } else {
          console.log(`   - contaBancaria: ❌ null`);
        }
        
        totalTested++;
        
      } catch (err) {
        console.error(`   ❌ Erro ao buscar detalhe: ${err.message}`);
      }
      
      console.log('\n════════════════════════════════════════════════════════════════\n');
    }

    // 4. Resumo
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  📊 RESUMO DOS TESTES                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log(`   Total testadas: ${totalTested} contas`);
    console.log(`   Com categoria: ${totalWithCategoria} (${Math.round(totalWithCategoria/totalTested*100)}%)`);
    console.log(`   Com forma pagamento: ${totalWithFormaPagto} (${Math.round(totalWithFormaPagto/totalTested*100)}%)`);
    console.log(`   Com conta bancária: ${totalWithContaBanc} (${Math.round(totalWithContaBanc/totalTested*100)}%)`);
    
    console.log('\n   🎯 CONCLUSÃO:');
    if (totalWithCategoria > 0) {
      console.log('   ✅ Categoria ESTÁ DISPONÍVEL no endpoint de detalhe');
      console.log('   ✅ Enrichment FUNCIONARÁ corretamente!');
    } else {
      console.log('   ⚠️  Nenhuma conta com categoria encontrada');
      console.log('   ℹ️  Isso pode significar que as contas no Tiny não têm categoria vinculada');
    }
    
    console.log('\n');

  } catch (err) {
    console.error('❌ Erro geral:', err);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
testContaRecebidaDetalhe().catch(console.error);
