/**
 * scripts/teste-sync-contas-pagas.js
 * Testa sincronização de contas pagas com período pequeno
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testeSync() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🧪 TESTE: Sincronização Contas Pagas                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    const company = await prisma.company.findFirst({
      include: { connections: true }
    });

    if (!company) {
      console.error('❌ Nenhuma empresa encontrada');
      return;
    }

    if (!company.connections || company.connections.length === 0) {
      console.error('❌ Empresa sem conexão Tiny');
      return;
    }

    console.log(`📋 Empresa: ${company.name}`);
    console.log(`🔗 Conexão: ${company.connections[0].accountName || 'Tiny ERP'}\n`);

    // Importar função de sync
    const { runSync } = require('../jobs/sync.ts');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 EXECUTANDO SINCRONIZAÇÃO (3 dias)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-03');

    const result = await runSync({
      companyId: company.id,
      modules: ['vw_contas_pagas'],
      startDate,
      endDate,
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESULTADO DA SINCRONIZAÇÃO');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(result, null, 2));

    // ETAPA 2: Verificar dados sincronizados
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICAÇÃO DOS DADOS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const contas = await prisma.vwContasPagas.findMany({
      where: { companyId: company.id },
      take: 5,
      orderBy: { dataPagamento: 'desc' }
    });

    console.log(`✅ Total de contas sincronizadas: ${contas.length}\n`);

    if (contas.length > 0) {
      console.log('📋 Primeiras 5 contas:\n');
      
      contas.forEach((conta, i) => {
        console.log(`${i + 1}. ID: ${conta.tituloId}`);
        console.log(`   Fornecedor: ${conta.fornecedor}`);
        console.log(`   Categoria: ${conta.categoria}`);
        console.log(`   Centro Custo: ${conta.centroCusto || 'null'}`);
        console.log(`   Forma Pagamento: ${conta.formaPagamento}`);
        console.log(`   Conta Bancária: ${conta.contaBancaria}`);
        console.log(`   Valor Pago: R$ ${conta.valorPago}`);
        console.log(`   Data Pagamento: ${conta.dataPagamento.toISOString().split('T')[0]}`);
        console.log();
      });

      // Análise de campos
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📊 ANÁLISE DE CAMPOS');
      console.log('═══════════════════════════════════════════════════════════\n');

      const comCategoria = contas.filter(c => c.categoria && c.categoria !== 'N/D').length;
      const comFormaPagto = contas.filter(c => c.formaPagamento && c.formaPagamento !== 'N/D').length;
      const comCentroCusto = contas.filter(c => c.centroCusto).length;
      const comContaBancaria = contas.filter(c => c.contaBancaria && c.contaBancaria !== 'N/D').length;

      console.log(`✅ Categoria preenchida: ${comCategoria}/${contas.length}`);
      console.log(`✅ Forma Pagamento preenchida: ${comFormaPagto}/${contas.length}`);
      console.log(`⚠️  Centro Custo preenchido: ${comCentroCusto}/${contas.length}`);
      console.log(`⚠️  Conta Bancária preenchida: ${comContaBancaria}/${contas.length}`);
      
      console.log('\n📌 Observações:');
      console.log('   • Centro Custo: Esperado estar vazio (não existe na API)');
      console.log('   • Conta Bancária: Esperado ser "N/D" (limitação da API)\n');
    }

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ TESTE CONCLUÍDO                                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('❌ Erro:', err);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testeSync().catch(console.error);
