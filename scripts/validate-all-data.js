/**
 * Script de validação completa após implementação das melhorias P1/P2
 * Verifica dados em todas as 6 views
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateView(viewName, fields, sampleSize = 5) {
  const model = prisma[viewName];
  const totalRecords = await model.count();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 ${viewName.toUpperCase()}`);
  console.log(`${'='.repeat(70)}`);
  
  if (totalRecords === 0) {
    console.log('⚠️  NENHUM REGISTRO ENCONTRADO');
    return { view: viewName, total: 0, status: 'EMPTY' };
  }

  console.log(`✅ Total de registros: ${totalRecords}`);
  
  // Buscar amostra
  const samples = await model.findMany({
    take: sampleSize,
    orderBy: { id: 'asc' },
  });

  console.log(`\n📋 AMOSTRA (${Math.min(sampleSize, samples.length)} registros):`);
  console.log('-'.repeat(70));

  // Análise de campos
  const fieldStats = {};
  for (const field of fields) {
    let nonEmptyCount = 0;
    let ndCount = 0;
    let nullCount = 0;
    
    for (const sample of samples) {
      const value = sample[field];
      if (value === null || value === undefined) {
        nullCount++;
      } else if (String(value).trim() === 'N/D' || String(value).trim() === '0.00' || String(value).trim() === '0') {
        ndCount++;
      } else {
        nonEmptyCount++;
      }
    }
    
    fieldStats[field] = { nonEmptyCount, ndCount, nullCount };
  }

  // Exibir primeira amostra completa
  if (samples.length > 0) {
    console.log('\n🔍 PRIMEIRO REGISTRO:');
    for (const field of fields) {
      const value = samples[0][field];
      const displayValue = value !== null && value !== undefined 
        ? (typeof value === 'object' && 'toNumber' in value ? value.toNumber() : String(value))
        : 'NULL';
      console.log(`  ${field}: ${displayValue}`);
    }
  }

  // Resumo de preenchimento
  console.log('\n📈 RESUMO DE PREENCHIMENTO:');
  for (const field of fields) {
    const stats = fieldStats[field];
    const total = samples.length;
    const filled = stats.nonEmptyCount;
    const percentage = total > 0 ? ((filled / total) * 100).toFixed(0) : 0;
    
    let status = '✅';
    if (filled === 0) status = '❌';
    else if (filled < total / 2) status = '⚠️ ';
    
    console.log(`  ${status} ${field}: ${filled}/${total} (${percentage}%) preenchidos`);
  }

  return {
    view: viewName,
    total: totalRecords,
    sampleSize: samples.length,
    fieldStats,
    status: 'OK',
  };
}

async function main() {
  console.log('\n🚀 VALIDAÇÃO COMPLETA DO PORTAL DO CONTADOR');
  console.log('='repeat(70));

  const results = [];

  // 1. vw_vendas (com categorias enriquecidas)
  results.push(await validateView('vwVendas', [
    'dataHora',
    'produto',
    'categoria',
    'quantidade',
    'valorUnitario',
    'valorTotal',
    'formaPagamento',
    'vendedor',
    'cliente',
    'cnpjCliente',
    'caixa',
    'status',
  ]));

  // 2. vw_contas_receber_posicao
  results.push(await validateView('vwContasReceberPosicao', [
    'tituloId',
    'cliente',
    'cnpj',
    'categoria',
    'centroCusto',
    'dataEmissao',
    'dataVencimento',
    'valor',
    'dataPosicao',
  ]));

  // 3. vw_contas_pagar
  results.push(await validateView('vwContasPagar', [
    'tituloId',
    'fornecedor',
    'categoria',
    'centroCusto',
    'dataEmissao',
    'dataVencimento',
    'valor',
    'status',
    'formaPagto',
  ]));

  // 4. vw_contas_pagas (P1)
  results.push(await validateView('vwContasPagas', [
    'tituloId',
    'fornecedor',
    'categoria',
    'centroCusto',
    'dataPagamento',
    'valorTitulo',
    'valorPago',
    'desconto',
    'juros',
    'multa',
    'formaPagamento',
    'status',
  ]));

  // 5. vw_contas_recebidas (P1)
  results.push(await validateView('vwContasRecebidas', [
    'tituloId',
    'cliente',
    'cnpjCpf',
    'categoria',
    'centroCusto',
    'dataRecebimento',
    'valorTitulo',
    'valorRecebido',
    'desconto',
    'juros',
    'multa',
    'comissaoCartao',
    'comissaoMktplaces',
    'formaRecebimento',
    'status',
  ]));

  // 6. vw_estoque (P2)
  results.push(await validateView('vwEstoque', [
    'dataSnapshot',
    'produtoSku',
    'produtoDescricao',
    'deposito',
    'saldoAtual',
    'saldoReservado',
    'saldoDisponivel',
    'custoMedio',
    'valorTotalEstoque',
    'dataUltimaMovimentacao',
  ]));

  // Resumo Final
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 RESUMO FINAL');
  console.log(`${'='.repeat(70)}`);

  for (const result of results) {
    const statusIcon = result.status === 'OK' ? '✅' : result.status === 'EMPTY' ? '⚠️ ' : '❌';
    console.log(`${statusIcon} ${result.view}: ${result.total} registros`);
  }

  const totalRecords = results.reduce((sum, r) => sum + r.total, 0);
  console.log(`\n🎯 TOTAL GERAL: ${totalRecords} registros em ${results.length} views`);

  const emptyViews = results.filter(r => r.status === 'EMPTY');
  if (emptyViews.length > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${emptyViews.length} view(s) sem dados:`);
    emptyViews.forEach(v => console.log(`   - ${v.view}`));
    console.log('\n💡 Execute uma sincronização completa para preencher os dados.');
  } else {
    console.log('\n✅ SUCESSO! Todas as views contêm dados.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro na validação:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

