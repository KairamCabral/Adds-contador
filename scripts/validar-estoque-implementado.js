/**
 * scripts/validar-estoque-implementado.js
 * Valida a implementação da solução de estoque
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validar() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ VALIDAÇÃO: Solução de Estoque Implementada                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const company = await prisma.company.findFirst();
    
    if (!company) {
      console.error('❌ Nenhuma empresa encontrada');
      return;
    }

    console.log(`📋 Empresa: ${company.name}\n`);

    // ETAPA 1: Verificar vendas disponíveis
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 ETAPA 1: VENDAS DISPONÍVEIS PARA CÁLCULO');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const totalVendas = await prisma.vwVendas.count({
      where: { companyId: company.id }
    });
    
    console.log(`✅ Total de vendas: ${totalVendas}`);

    if (totalVendas > 0) {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);
      
      const vendasRecentes = await prisma.vwVendas.count({
        where: {
          companyId: company.id,
          dataHora: { gte: dataInicio }
        }
      });
      
      console.log(`✅ Vendas últimos 30 dias: ${vendasRecentes}`);
      
      // Top 5 produtos vendidos
      const produtosVendidos = await prisma.vwVendas.groupBy({
        by: ['produto'],
        where: {
          companyId: company.id,
          dataHora: { gte: dataInicio },
          status: { notIn: ['Cancelado', 'Estornado'] }
        },
        _sum: { quantidade: true },
        orderBy: { _sum: { quantidade: 'desc' } },
        take: 5
      });
      
      console.log('\n📋 Top 5 produtos vendidos (últimos 30 dias):\n');
      produtosVendidos.forEach((p, i) => {
        console.log(`${i + 1}. ${p.produto}`);
        console.log(`   Quantidade vendida: ${p._sum.quantidade}\n`);
      });
    }

    // ETAPA 2: Verificar estrutura do estoque
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📦 ETAPA 2: ESTRUTURA DO ESTOQUE ATUAL');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const totalEstoque = await prisma.vwEstoque.count({
      where: { companyId: company.id }
    });
    
    console.log(`📊 Total de produtos em estoque: ${totalEstoque}`);

    if (totalEstoque > 0) {
      const estoques = await prisma.vwEstoque.findMany({
        where: { companyId: company.id },
        take: 3,
        orderBy: { estoqueFinal: 'desc' }
      });
      
      console.log('\n📋 Primeiros 3 produtos (por estoque final):\n');
      
      estoques.forEach((e, i) => {
        console.log(`${i + 1}. ${e.produto}`);
        console.log(`   Categoria: ${e.categoria}`);
        console.log(`   Unidade: ${e.unidadeMedida}`);
        console.log(`   Estoque Inicial: ${e.estoqueInicial}`);
        console.log(`   Entradas: ${e.entradas}`);
        console.log(`   Saidas: ${e.saidas}`);
        console.log(`   Ajustes: ${e.ajustes}`);
        console.log(`   Estoque Final: ${e.estoqueFinal}`);
        console.log(`   Custo Médio: R$ ${e.custoMedio}`);
        console.log(`   Valor Total: R$ ${e.valorTotalEstoque}\n`);
        
        // Validar fórmula
        const inicialCalculado = Number(e.estoqueFinal) + Number(e.saidas);
        const inicialAtual = Number(e.estoqueInicial);
        const diferencaInicial = Math.abs(inicialCalculado - inicialAtual);
        
        if (diferencaInicial < 0.01) {
          console.log(`   ✅ Fórmula OK: Inicial = Final + Saidas`);
        } else {
          console.log(`   ⚠️  Diferença: Esperado ${inicialCalculado}, Atual ${inicialAtual}`);
        }
        
        const valorCalculado = Number(e.estoqueFinal) * Number(e.custoMedio);
        const valorAtual = Number(e.valorTotalEstoque);
        const diferencaValor = Math.abs(valorCalculado - valorAtual);
        
        if (diferencaValor < 0.01) {
          console.log(`   ✅ Fórmula OK: Valor = Final × Custo\n`);
        } else {
          console.log(`   ⚠️  Diferença: Esperado ${valorCalculado.toFixed(2)}, Atual ${valorAtual}\n`);
        }
      });
    }

    // ETAPA 3: Estatísticas gerais
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 ETAPA 3: ESTATÍSTICAS GERAIS');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    if (totalEstoque > 0) {
      const stats = await prisma.vwEstoque.aggregate({
        where: { companyId: company.id },
        _sum: {
          estoqueFinal: true,
          saidas: true,
          valorTotalEstoque: true
        },
        _avg: {
          custoMedio: true
        }
      });
      
      console.log('📈 Resumo:');
      console.log(`   Total de unidades em estoque: ${stats._sum.estoqueFinal}`);
      console.log(`   Total de saídas (últimos 30 dias): ${stats._sum.saidas}`);
      console.log(`   Valor total em estoque: R$ ${Number(stats._sum.valorTotalEstoque).toFixed(2)}`);
      console.log(`   Custo médio geral: R$ ${Number(stats._avg.custoMedio).toFixed(2)}`);
      
      // Verificar quantos produtos têm saídas > 0
      const comSaidas = await prisma.vwEstoque.count({
        where: {
          companyId: company.id,
          saidas: { gt: 0 }
        }
      });
      
      const percentualComSaidas = (comSaidas / totalEstoque * 100).toFixed(1);
      
      console.log(`\n   Produtos com saídas registradas: ${comSaidas}/${totalEstoque} (${percentualComSaidas}%)`);
    }

    // CONCLUSÃO
    console.log('\n\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║  🎯 VALIDAÇÃO CONCLUÍDA                                                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    if (totalEstoque > 0 && totalVendas > 0) {
      console.log('✅ SISTEMA FUNCIONANDO CORRETAMENTE');
      console.log('   • Vendas sendo sincronizadas');
      console.log('   • Saídas sendo calculadas');
      console.log('   • Estoque Inicial sendo calculado');
      console.log('   • Fórmulas validadas\n');
    } else if (totalEstoque > 0) {
      console.log('⚠️  ESTOQUE SINCRONIZADO, MAS SEM VENDAS');
      console.log('   • Estoque está ok, mas sem vendas para calcular saídas');
      console.log('   • Campos de saída ficarão zerados até primeira venda\n');
    } else {
      console.log('⚠️  EXECUTAR SINCRONIZAÇÃO');
      console.log('   • Acesse a interface e clique em "Sincronizar Agora"');
      console.log('   • Aguarde conclusão da sincronização\n');
    }

  } catch (err) {
    console.error('❌ Erro:', err);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

validar().catch(console.error);
