const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function triggerSync() {
  console.log('\n🔄 ACIONANDO SINCRONIZAÇÃO MANUAL\n');

  try {
    // Buscar company
    const company = await prisma.company.findFirst();
    if (!company) {
      console.error('❌ Nenhuma company encontrada');
      process.exit(1);
    }

    console.log(`✅ Company encontrada: ${company.name}\n`);

    // Definir período (últimos 30 dias)
    const hoje = new Date();
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    console.log(`📅 Período: ${trintaDiasAtras.toISOString().split('T')[0]} até ${hoje.toISOString().split('T')[0]}\n`);
    console.log('⏳ Acionando sincronização via API...\n');

    // Fazer chamada HTTP ao endpoint de sync
    const response = await fetch('http://localhost:3000/api/admin/sync/period', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: trintaDiasAtras.toISOString().split('T')[0],
        endDate: hoje.toISOString().split('T')[0],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📄 Resultado:', JSON.stringify(result, null, 2));

    console.log('\n✅ SINCRONIZAÇÃO CONCLUÍDA!\n');

    // Verificar quantos registros foram criados
    const countPagar = await prisma.vwContasPagar.count();
    const countPagas = await prisma.vwContasPagas.count();
    
    console.log('📊 Registros sincronizados:');
    console.log(`   vw_contas_pagar: ${countPagar}`);
    console.log(`   vw_contas_pagas: ${countPagas}\n`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

triggerSync();
