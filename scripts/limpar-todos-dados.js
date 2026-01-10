#!/usr/bin/env node

/**
 * Script para limpar TODOS os dados das views e forçar ressincronização completa
 * Isso garante que todos os dados sejam puxados novamente com as correções aplicadas
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Iniciando limpeza completa de dados...\n');

  try {
    // 1. Vendas
    const vendas = await prisma.vwVendas.deleteMany({});
    console.log(`✅ Vendas: ${vendas.count} registros removidos`);

    // 2. Contas a Receber (Posição)
    const contasReceber = await prisma.vwContasReceberPosicao.deleteMany({});
    console.log(`✅ Contas a Receber (Posição): ${contasReceber.count} registros removidos`);

    // 3. Contas Recebidas
    const contasRecebidas = await prisma.vwContasRecebidas.deleteMany({});
    console.log(`✅ Contas Recebidas: ${contasRecebidas.count} registros removidos`);

    // 4. Contas a Pagar
    const contasPagar = await prisma.vwContasPagar.deleteMany({});
    console.log(`✅ Contas a Pagar: ${contasPagar.count} registros removidos`);

    // 5. Contas Pagas
    const contasPagas = await prisma.vwContasPagas.deleteMany({});
    console.log(`✅ Contas Pagas: ${contasPagas.count} registros removidos`);

    // 6. Estoque
    const estoque = await prisma.vwEstoque.deleteMany({});
    console.log(`✅ Estoque: ${estoque.count} registros removidos`);

    // 7. Limpar cache de sincronização (rawPayload)
    const rawPayloads = await prisma.rawPayload.deleteMany({});
    console.log(`✅ Cache (rawPayload): ${rawPayloads.count} registros removidos`);

    console.log('\n✅ LIMPEZA COMPLETA!');
    console.log('\n📋 Próximo passo:');
    console.log('   Execute a sincronização via interface web ou API para repopular os dados.');
    console.log('   URL: http://localhost:3000');
    
  } catch (error) {
    console.error('\n❌ Erro ao limpar dados:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
