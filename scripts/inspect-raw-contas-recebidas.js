/**
 * Script de investigação: Inspecionar payloads brutos de contas recebidas
 * Objetivo: Descobrir exatamente como a API Tiny retorna formaPagamento e contaBancaria
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectRawPayloads() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 INVESTIGAÇÃO: PAYLOADS BRUTOS - CONTAS RECEBIDAS        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // Buscar payloads raw de contas recebidas
    console.log('📦 Buscando payloads raw de contas recebidas...\n');
    
    const payloads = await prisma.rawPayload.findMany({
      where: {
        module: 'vw_contas_recebidas'
      },
      orderBy: { receivedAt: 'desc' },
      take: 5
    });

    if (payloads.length === 0) {
      console.log('⚠️  Nenhum payload encontrado. Execute uma sincronização primeiro.\n');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Encontrados ${payloads.length} payloads\n`);
    console.log('════════════════════════════════════════════════════════════════\n');

    let totalAnalisados = 0;
    let totalComFormaPagto = 0;
    let totalComContaBanc = 0;
    const estruturasFormaPagto = new Set();
    const estruturasContaBanc = new Set();
    const todosOsCampos = new Set();

    for (const payload of payloads) {
      totalAnalisados++;
      const data = payload.payload;
      
      console.log(`📄 PAYLOAD ${totalAnalisados}/${payloads.length}`);
      console.log(`   ID: ${payload.externalId || 'N/A'}`);
      console.log(`   Recebido em: ${payload.receivedAt.toISOString()}\n`);

      // Coletar todos os campos
      Object.keys(data).forEach(key => todosOsCampos.add(key));

      // Log do payload completo (estrutura resumida)
      console.log('   📋 CAMPOS PRINCIPAIS:');
      console.log(`   - id: ${data.id}`);
      console.log(`   - cliente: ${data.cliente?.nome || 'N/A'}`);
      console.log(`   - valor: ${data.valor}`);
      console.log(`   - situacao: ${data.situacao}`);
      console.log(`   - data_pagamento: ${data.data_pagamento || data.dataPagamento || 'N/A'}\n`);

      // Análise específica de campos
      console.log('   🔍 ANÁLISE DE CAMPOS ESPECÍFICOS:\n');

      // 1. formaPagamento / forma_pagamento
      console.log('   📌 FORMA PAGAMENTO:');
      const todasVariacoesFormaPagto = [
        'formaPagamento', 'forma_pagamento',
        'meioPagamento', 'meio_pagamento',
        'tipoPagamento', 'tipo_pagamento',
        'descricaoFormaPagamento', 'descricao_forma_pagamento'
      ];
      
      let encontrouFormaPagto = false;
      for (const campo of todasVariacoesFormaPagto) {
        if (data[campo] !== undefined) {
          console.log(`      ✅ ${campo}: ${JSON.stringify(data[campo])}`);
          console.log(`         typeof: ${typeof data[campo]}`);
          estruturasFormaPagto.add(`${campo} (${typeof data[campo]})`);
          if (data[campo]) totalComFormaPagto++;
          encontrouFormaPagto = true;
        }
      }
      if (!encontrouFormaPagto) {
        console.log('      ❌ Nenhuma variação encontrada');
      }

      // 2. contaBancaria / conta_bancaria
      console.log('\n   📌 CONTA BANCÁRIA:');
      const todasVariacoesContaBanc = [
        'contaBancaria', 'conta_bancaria',
        'banco', 'nomeBanco', 'nome_banco',
        'descricaoBanco', 'descricao_banco',
        'contaRecebimento', 'conta_recebimento'
      ];
      
      let encontrouContaBanc = false;
      for (const campo of todasVariacoesContaBanc) {
        if (data[campo] !== undefined) {
          console.log(`      ✅ ${campo}: ${JSON.stringify(data[campo])}`);
          console.log(`         typeof: ${typeof data[campo]}`);
          estruturasContaBanc.add(`${campo} (${typeof data[campo]})`);
          if (data[campo]) totalComContaBanc++;
          encontrouContaBanc = true;
        }
      }
      if (!encontrouContaBanc) {
        console.log('      ❌ Nenhuma variação encontrada');
      }

      console.log('\n════════════════════════════════════════════════════════════════\n');
    }

    // RESUMO FINAL
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  📊 RESUMO DA ANÁLISE                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`   Total analisados: ${totalAnalisados} payloads\n`);

    console.log('   💳 FORMA PAGAMENTO:');
    console.log(`      - Payloads com dados: ${totalComFormaPagto}`);
    if (estruturasFormaPagto.size > 0) {
      console.log(`      - Estruturas encontradas:`);
      estruturasFormaPagto.forEach(est => console.log(`        • ${est}`));
    } else {
      console.log(`      - ⚠️ NENHUMA estrutura encontrada!`);
    }

    console.log('\n   🏦 CONTA BANCÁRIA:');
    console.log(`      - Payloads com dados: ${totalComContaBanc}`);
    if (estruturasContaBanc.size > 0) {
      console.log(`      - Estruturas encontradas:`);
      estruturasContaBanc.forEach(est => console.log(`        • ${est}`));
    } else {
      console.log(`      - ⚠️ NENHUMA estrutura encontrada!`);
    }

    console.log('\n   📋 TODOS OS CAMPOS ENCONTRADOS:');
    const camposArray = Array.from(todosOsCampos).sort();
    camposArray.forEach(campo => console.log(`      - ${campo}`));

    console.log('\n   🎯 CONCLUSÕES:');
    if (totalComFormaPagto === 0 && estruturasFormaPagto.size === 0) {
      console.log('      ❌ FORMA PAGAMENTO: NÃO encontrada em nenhum payload');
      console.log('         → API Tiny não retorna esse campo para contas recebidas');
      console.log('         → Manter como "N/D" no sistema');
    } else {
      console.log(`      ✅ FORMA PAGAMENTO: Encontrada em ${totalComFormaPagto} payloads`);
      console.log('         → Verificar se extração está correta no transformer');
    }

    if (totalComContaBanc === 0 && estruturasContaBanc.size === 0) {
      console.log('\n      ❌ CONTA BANCÁRIA: NÃO encontrada em nenhum payload');
      console.log('         → API Tiny não retorna esse campo para contas recebidas');
      console.log('         → Manter como "N/D" no sistema');
    } else {
      console.log(`\n      ✅ CONTA BANCÁRIA: Encontrada em ${totalComContaBanc} payloads`);
      console.log('         → Verificar se extração está correta no transformer');
    }

    console.log('\n');

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspectRawPayloads().catch(console.error);
