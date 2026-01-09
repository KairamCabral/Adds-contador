/**
 * Script para corrigir status antigos com "SITUACAO_7" etc
 * Execute: node scripts/fix-status-antigos.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const statusMap = {
  0: 'Cancelado',
  1: 'Aprovado',
  2: 'Cancelado',
  3: 'Atendido',
  4: 'Preparando envio',
  5: 'Faturado',
  6: 'Pronto para envio',
  7: 'Pronto para envio',
  8: 'Pronto para envio',
  9: 'Enviado',
  10: 'Entregue',
};

async function fixStatus() {
  console.log('\n🔧 CORRIGINDO STATUS ANTIGOS\n');

  try {
    // Buscar TODOS os registros e filtrar depois
    const vendas = await prisma.vwVendas.findMany();
    
    // Filtrar os que têm SITUACAO_ ou são apenas números
    const vendasParaCorrigir = vendas.filter(v => {
      return v.status.includes('SITUACAO') || 
             v.status.includes('SITUAÇÃO') ||
             /^\d+$/.test(v.status);
    });

    console.log(`📊 Encontrados ${vendasParaCorrigir.length} registros para corrigir\n`);

    if (vendasParaCorrigir.length === 0) {
      console.log('✅ Nenhum registro precisa ser corrigido!\n');
      await prisma.$disconnect();
      return;
    }

    let corrigidos = 0;

    // Atualizar cada um
    for (const venda of vendasParaCorrigir) {
      let novoStatus = venda.status;

      // Tentar extrair número de "SITUACAO_7"
      const match = venda.status.match(/SITUA[CÇ][AÃ]O[_\s]*(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        novoStatus = statusMap[num] || 'Status desconhecido';
      } 
      // Se for apenas número
      else if (/^\d+$/.test(venda.status)) {
        const num = parseInt(venda.status, 10);
        novoStatus = statusMap[num] || 'Status desconhecido';
      }

      // Atualizar se mudou
      if (novoStatus !== venda.status) {
        await prisma.vwVendas.update({
          where: { id: venda.id },
          data: { status: novoStatus }
        });
        
        console.log(`✅ ${venda.status} → ${novoStatus}`);
        corrigidos++;
      }
    }

    console.log(`\n✨ ${corrigidos} registros corrigidos com sucesso!\n`);

    // Mostrar resumo
    const statusCount = await prisma.$queryRaw`
      SELECT "Status" as status, COUNT(*) as total
      FROM vw_vendas
      GROUP BY "Status"
      ORDER BY total DESC
    `;

    console.log('📊 RESUMO DOS STATUS NO BANCO:\n');
    statusCount.forEach(row => {
      console.log(`   ${row.status}: ${row.total}x`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixStatus();
