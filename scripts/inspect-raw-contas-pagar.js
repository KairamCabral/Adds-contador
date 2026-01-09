const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function inspect() {
  console.log('\n🔍 ANÁLISE CONTAS A PAGAR - Via Dados RAW\n');

  try {
    // Buscar payloads raw salvos
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 BUSCANDO PAYLOADS SALVOS NO BANCO');
    console.log('═══════════════════════════════════════════════════════\n');

    const rawPayloads = await prisma.rawPayload.findMany({
      where: { module: 'vw_contas_pagar' },
      orderBy: { receivedAt: 'desc' },
      take: 3,
    });

    if (rawPayloads.length === 0) {
      console.log('⚠️  Nenhum payload raw encontrado para vw_contas_pagar');
      console.log('💡 Execute uma sincronização primeiro para coletar dados\n');
      process.exit(0);
    }

    console.log(`✅ Encontrados ${rawPayloads.length} payloads. Analisando...\n`);

    rawPayloads.forEach((raw, idx) => {
      console.log(`\n═══════════════════════════════════════════════════════`);
      console.log(`📄 PAYLOAD ${idx + 1} (ID: ${raw.externalId})`);
      console.log(`═══════════════════════════════════════════════════════\n`);
      
      const conta = raw.payload;
      console.log(JSON.stringify(conta, null, 2));

      console.log('\n❓ CAMPOS CRÍTICOS:');
      console.log(`   fornecedor: ${JSON.stringify(conta.fornecedor)}`);
      console.log(`   fornecedor (tipo): ${typeof conta.fornecedor}`);
      if (typeof conta.fornecedor === 'object' && conta.fornecedor) {
        console.log(`   fornecedor.nome: ${JSON.stringify(conta.fornecedor.nome)}`);
      }
      
      console.log(`\n   categoria: ${JSON.stringify(conta.categoria)}`);
      console.log(`   categoria (tipo): ${typeof conta.categoria}`);
      if (typeof conta.categoria === 'object' && conta.categoria) {
        console.log(`   categoria.nome: ${JSON.stringify(conta.categoria.nome)}`);
        console.log(`   categoria.descricao: ${JSON.stringify(conta.categoria.descricao)}`);
      }
      
      console.log(`\n   centroCusto: ${JSON.stringify(conta.centroCusto)}`);
      console.log(`   centro_custo: ${JSON.stringify(conta.centro_custo)}`);
      console.log(`   centroCusto (tipo): ${typeof (conta.centroCusto || conta.centro_custo)}`);
      if (typeof conta.centroCusto === 'object' && conta.centroCusto) {
        console.log(`   centroCusto.nome: ${JSON.stringify(conta.centroCusto.nome)}`);
      }
      
      console.log(`\n   formaPagamento: ${JSON.stringify(conta.formaPagamento)}`);
      console.log(`   forma_pagamento: ${JSON.stringify(conta.forma_pagamento)}`);
      console.log(`   formaPagamento (tipo): ${typeof (conta.formaPagamento || conta.forma_pagamento)}`);
      if (typeof conta.formaPagamento === 'object' && conta.formaPagamento) {
        console.log(`   formaPagamento.nome: ${JSON.stringify(conta.formaPagamento.nome)}`);
      }

      console.log(`\n   situacao: ${JSON.stringify(conta.situacao)}`);
      console.log(`   data_emissao: ${JSON.stringify(conta.data_emissao)}`);
      console.log(`   data_vencimento: ${JSON.stringify(conta.data_vencimento)}`);
      console.log(`   valor: ${JSON.stringify(conta.valor)}`);
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 CONCLUSÕES:');
    console.log('═══════════════════════════════════════════════════════\n');

    const primeiraConta = rawPayloads[0].payload;
    
    console.log('FORNECEDOR:');
    if (typeof primeiraConta.fornecedor === 'object' && primeiraConta.fornecedor?.nome) {
      console.log('   ✅ É objeto com .nome - Transformer está CORRETO');
    } else {
      console.log('   ❌ NÃO é objeto com .nome - Transformer precisa correção');
    }

    console.log('\nCATEGORIA:');
    if (typeof primeiraConta.categoria === 'object' && primeiraConta.categoria?.descricao) {
      console.log('   ❌ É objeto com .descricao - Transformer está INCORRETO (busca .nome)');
    } else if (typeof primeiraConta.categoria === 'string') {
      console.log('   ✅ É string - Transformer precisa simplificar');
    } else if (!primeiraConta.categoria) {
      console.log('   ⚠️  É null/undefined - Campo não disponível na listagem');
    }

    console.log('\nCENTRO CUSTO:');
    const centroCusto = primeiraConta.centroCusto || primeiraConta.centro_custo;
    if (typeof centroCusto === 'object' && centroCusto?.nome) {
      console.log('   ✅ É objeto com .nome - Transformer está CORRETO');
    } else if (typeof centroCusto === 'string') {
      console.log('   ❌ É string - Transformer está INCORRETO (busca .nome)');
    } else if (!centroCusto) {
      console.log('   ⚠️  É null/undefined - Campo não disponível');
    }

    console.log('\nFORMA PAGAMENTO:');
    const formaPagto = primeiraConta.formaPagamento || primeiraConta.forma_pagamento;
    if (typeof formaPagto === 'object' && formaPagto?.nome) {
      console.log('   ✅ É objeto com .nome - Transformer está CORRETO');
    } else if (typeof formaPagto === 'string') {
      console.log('   ❌ É string - Transformer está INCORRETO (busca .nome)');
    } else if (!formaPagto) {
      console.log('   ⚠️  É null/undefined - Campo não disponível');
    }

    console.log('\n✅ ANÁLISE COMPLETA\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
