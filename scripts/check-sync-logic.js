const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function checkLogic() {
  console.log('\n🔍 VERIFICANDO LÓGICA DE SYNC - CONTAS PAGAR vs PAGAS\n');

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ANÁLISE DA LÓGICA ATUAL');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('✅ COMO FUNCIONA HOJE:\n');
    console.log('   1️⃣  syncContasPagar():');
    console.log('      → Busca contas com status "aberto"');
    console.log('      → Insere/atualiza em vw_contas_pagar\n');
    
    console.log('   2️⃣  syncContasPagas():');
    console.log('      → Busca contas com status "pago"');
    console.log('      → Insere/atualiza em vw_contas_pagas\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  PROBLEMA POTENCIAL:');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('   Se uma conta muda de ABERTO → PAGO:');
    console.log('   ❌ Ela PERMANECE em vw_contas_pagar');
    console.log('   ✅ Ela é ADICIONADA em vw_contas_pagas');
    console.log('   🚨 RESULTADO: Conta aparece em AMBAS as tabelas!\n');

    // Verificar se há duplicação
    const contasPagar = await prisma.vwContasPagar.findMany({
      select: { tituloId: true, fornecedor: true, status: true }
    });

    const contasPagas = await prisma.vwContasPagas.findMany({
      select: { tituloId: true, fornecedor: true, status: true }
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 VERIFICAÇÃO DE DUPLICAÇÃO:');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`   Total em vw_contas_pagar: ${contasPagar.length}`);
    console.log(`   Total em vw_contas_pagas: ${contasPagas.length}\n`);

    const titulosEmPagar = new Set(contasPagar.map(c => c.tituloId.toString()));
    const titulosEmPagas = new Set(contasPagas.map(c => c.tituloId.toString()));

    const duplicados = [...titulosEmPagar].filter(id => titulosEmPagas.has(id));

    if (duplicados.length > 0) {
      console.log(`   🚨 DUPLICADOS ENCONTRADOS: ${duplicados.length} títulos\n`);
      
      duplicados.slice(0, 5).forEach(id => {
        const emPagar = contasPagar.find(c => c.tituloId.toString() === id);
        const emPagas = contasPagas.find(c => c.tituloId.toString() === id);
        console.log(`   Título ${id}:`);
        console.log(`      Em PAGAR: status="${emPagar?.status}", fornecedor="${emPagar?.fornecedor}"`);
        console.log(`      Em PAGAS: status="${emPagas?.status}", fornecedor="${emPagas?.fornecedor}"`);
        console.log();
      });
    } else {
      console.log('   ✅ Nenhum duplicado encontrado\n');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('💡 RECOMENDAÇÃO:');
    console.log('═══════════════════════════════════════════════════════\n');

    if (duplicados.length > 0) {
      console.log('   ⚠️  AÇÃO NECESSÁRIA: Implementar limpeza automática\n');
      console.log('   Opções:');
      console.log('   1. Deletar de vw_contas_pagar as que viraram "pago"');
      console.log('   2. Modificar sync para verificar status antes de inserir');
      console.log('   3. Usar view SQL que filtra automaticamente\n');
    } else {
      console.log('   ✅ Sistema está funcionando corretamente!\n');
      console.log('   Possíveis razões:');
      console.log('   - Ainda não houve mudança de status');
      console.log('   - Banco foi limpo recentemente');
      console.log('   - Lógica já está tratando corretamente\n');
    }

    console.log('✅ ANÁLISE COMPLETA\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkLogic();
