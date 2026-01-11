/**
 * Script para limpar dados de Outubro 2025 do banco de dados
 * Execute com: node scripts/limpar-outubro-2025.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function limparOutubro2025() {
  const companyId = '89697d08-9711-4cc2-808e-1ca4704aa36c';
  const dataInicio = new Date('2025-10-01T00:00:00.000Z');
  const dataFim = new Date('2025-10-31T23:59:59.999Z');

  console.log('🗑️  Limpando dados de Outubro 2025...\n');

  try {
    // Limpar Vendas
    const vendas = await prisma.vwVendas.deleteMany({
      where: {
        companyId,
        dataHora: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
    });
    console.log(`✅ Vendas removidas: ${vendas.count}`);

    // Limpar Contas a Receber (Posição)
    const contasReceber = await prisma.vwContasReceberPosicao.deleteMany({
      where: {
        companyId,
        dataVencimento: {
          gte: new Date('2025-10-01'),
          lte: new Date('2025-10-31'),
        },
      },
    });
    console.log(`✅ Contas a Receber removidas: ${contasReceber.count}`);

    // Limpar Contas a Pagar
    const contasPagar = await prisma.vwContasPagar.deleteMany({
      where: {
        companyId,
        dataVencimento: {
          gte: new Date('2025-10-01'),
          lte: new Date('2025-10-31'),
        },
      },
    });
    console.log(`✅ Contas a Pagar removidas: ${contasPagar.count}`);

    // Limpar Contas Pagas
    const contasPagas = await prisma.vwContasPagas.deleteMany({
      where: {
        companyId,
        dataPagamento: {
          gte: new Date('2025-10-01'),
          lte: new Date('2025-10-31'),
        },
      },
    });
    console.log(`✅ Contas Pagas removidas: ${contasPagas.count}`);

    // Limpar Contas Recebidas
    const contasRecebidas = await prisma.vwContasRecebidas.deleteMany({
      where: {
        companyId,
        dataRecebimento: {
          gte: new Date('2025-10-01'),
          lte: new Date('2025-10-31'),
        },
      },
    });
    console.log(`✅ Contas Recebidas removidas: ${contasRecebidas.count}`);

    console.log('\n✅ Limpeza concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

limparOutubro2025();
