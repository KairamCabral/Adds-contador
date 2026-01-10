/**
 * scripts/investigacao-completa-estoque.js
 * INVESTIGAÇÃO COMPLETA: Todas as possibilidades para dados de estoque
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function decrypt(payload) {
  const ALGO = "aes-256-gcm";
  const IV_LENGTH = 12;
  const AUTH_TAG_LENGTH = 16;
  
  const key = Buffer.from(process.env.ENCRYPTION_MASTER_KEY || '', 'base64');
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGO, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

async function investigar() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  🔬 INVESTIGAÇÃO COMPLETA: Estoque - Todas as Possibilidades                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    // =============================================================================
    // ETAPA 1: BUSCAR UM PRODUTO PARA TESTES
    // =============================================================================
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('📦 ETAPA 1: BUSCAR PRODUTO PARA TESTES');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const respProdutos = await fetch(
      'https://erp.tiny.com.br/public-api/v3/produtos?limite=1',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!respProdutos.ok) {
      console.error(`❌ Erro ao buscar produtos: ${respProdutos.status}`);
      return;
    }

    const produtos = await respProdutos.json();
    
    if (!produtos.itens || produtos.itens.length === 0) {
      console.log('⚠️  Nenhum produto encontrado');
      return;
    }

    const produtoTeste = produtos.itens[0];
    const idProduto = produtoTeste.id;
    
    console.log(`✅ Produto de teste: ID ${idProduto}`);
    console.log(`   Nome: ${produtoTeste.nome || produtoTeste.descricao}`);
    console.log(`   SKU: ${produtoTeste.sku || 'N/A'}`);
    console.log(`   Saldo atual: ${produtoTeste.saldo || produtoTeste.saldoFisico || 'N/A'}`);

    // =============================================================================
    // ETAPA 2: TESTAR ENDPOINT /estoque/{idProduto}
    // =============================================================================
    console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 ETAPA 2: ENDPOINT /estoque/{idProduto}');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    await new Promise(r => setTimeout(r, 300));

    const respEstoque = await fetch(
      `https://erp.tiny.com.br/public-api/v3/estoque/${idProduto}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (respEstoque.ok) {
      const estoque = await respEstoque.json();
      console.log('✅ ENDPOINT EXISTE!\n');
      console.log('📋 Estrutura retornada:');
      console.log(JSON.stringify(estoque, null, 2));
      
      // Analisar campos disponíveis
      console.log('\n🔍 ANÁLISE DE CAMPOS:');
      if (estoque.kit) {
        console.log('   ✅ kit: Array de produtos/componentes');
        estoque.kit.forEach((item, i) => {
          console.log(`      ${i + 1}. produto: ${JSON.stringify(item.produto)}`);
          console.log(`         quantidade: ${item.quantidade}`);
        });
      }
      if (estoque.producao) {
        console.log('   ✅ producao: Dados de produção');
        console.log(`      ${JSON.stringify(estoque.producao)}`);
      }
      if (estoque.depositos) {
        console.log('   ✅ depositos: Array de depósitos');
        estoque.depositos.forEach((dep, i) => {
          console.log(`      ${i + 1}. ${dep.nome}: saldo ${dep.saldo}, reservado ${dep.reservado}, disponível ${dep.disponivel}`);
        });
      }
    } else {
      console.log(`❌ Endpoint não existe ou sem permissão: ${respEstoque.status}`);
    }

    // =============================================================================
    // ETAPA 3: TESTAR ENDPOINTS DE MOVIMENTAÇÕES
    // =============================================================================
    console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📈 ETAPA 3: ENDPOINTS DE MOVIMENTAÇÕES');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const endpointsMovimentacao = [
      '/estoque/movimentacoes',
      `/estoque/${idProduto}/movimentacoes`,
      `/produtos/${idProduto}/movimentacoes`,
      '/movimentacoes-estoque',
      `/movimentacoes-estoque/produto/${idProduto}`,
    ];

    for (const endpoint of endpointsMovimentacao) {
      console.log(`🔎 Testando: ${endpoint}`);
      
      await new Promise(r => setTimeout(r, 300));
      
      try {
        const resp = await fetch(
          `https://erp.tiny.com.br/public-api/v3${endpoint}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (resp.ok) {
          const data = await resp.json();
          console.log(`   ✅ SUCESSO! Dados:`);
          console.log(JSON.stringify(data, null, 2).substring(0, 500));
          console.log('\n');
        } else {
          console.log(`   ❌ ${resp.status}`);
        }
      } catch (err) {
        console.log(`   ❌ Erro: ${err.message.substring(0, 50)}`);
      }
    }

    // =============================================================================
    // ETAPA 4: TESTAR ENDPOINTS DE COMPRAS/ENTRADAS
    // =============================================================================
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📦 ETAPA 4: ENDPOINTS DE COMPRAS/ENTRADAS');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const endpointsCompras = [
      '/pedidos-compra',
      '/compras',
      '/notas-fiscais?tipo=entrada',
      '/notas-fiscais/entrada',
      '/nfe/entrada',
      '/nfe?tipo=entrada',
    ];

    for (const endpoint of endpointsCompras) {
      console.log(`🔎 Testando: ${endpoint}`);
      
      await new Promise(r => setTimeout(r, 300));
      
      try {
        const resp = await fetch(
          `https://erp.tiny.com.br/public-api/v3${endpoint}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (resp.ok) {
          const data = await resp.json();
          console.log(`   ✅ SUCESSO!`);
          
          if (data.itens && data.itens.length > 0) {
            console.log(`   📋 ${data.itens.length} itens encontrados`);
            console.log(`   Primeiro item:`);
            console.log(JSON.stringify(data.itens[0], null, 2).substring(0, 300));
          } else {
            console.log(`   Estrutura: ${JSON.stringify(data).substring(0, 200)}`);
          }
          console.log('\n');
        } else {
          console.log(`   ❌ ${resp.status}`);
        }
      } catch (err) {
        console.log(`   ❌ Erro: ${err.message.substring(0, 50)}`);
      }
    }

    // =============================================================================
    // ETAPA 5: ANALISAR VENDAS SINCRONIZADAS
    // =============================================================================
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 ETAPA 5: ANALISAR VENDAS SINCRONIZADAS');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const company = await prisma.company.findFirst();
    
    if (company) {
      // Contar total de vendas
      const totalVendas = await prisma.vwVendas.count({
        where: { companyId: company.id }
      });
      
      console.log(`✅ Total de vendas sincronizadas: ${totalVendas}`);
      
      if (totalVendas > 0) {
        // Buscar produtos únicos
        const produtosVendidos = await prisma.vwVendas.groupBy({
          by: ['produto'],
          where: { companyId: company.id },
          _count: true,
          _sum: { quantidade: true },
          orderBy: { _sum: { quantidade: 'desc' } },
          take: 10
        });
        
        console.log(`✅ Produtos únicos vendidos: ${produtosVendidos.length}`);
        console.log('\n📋 Top 10 produtos mais vendidos:\n');
        
        produtosVendidos.forEach((p, i) => {
          console.log(`${i + 1}. ${p.produto}`);
          console.log(`   Vendas: ${p._count} transações`);
          console.log(`   Quantidade total: ${p._sum.quantidade}`);
          console.log();
        });
      }
    }

    // =============================================================================
    // ETAPA 6: ENDPOINT DE PRODUTO INDIVIDUAL
    // =============================================================================
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('🔍 ETAPA 6: ENDPOINT /produtos/{id} (DETALHE)');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    await new Promise(r => setTimeout(r, 300));

    const respProdutoDetalhe = await fetch(
      `https://erp.tiny.com.br/public-api/v3/produtos/${idProduto}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (respProdutoDetalhe.ok) {
      const produtoDetalhe = await respProdutoDetalhe.json();
      console.log('✅ Detalhe do produto obtido\n');
      console.log('📋 Campos disponíveis:');
      console.log(JSON.stringify(produtoDetalhe, null, 2));
    } else {
      console.log(`❌ Erro: ${respProdutoDetalhe.status}`);
    }

    // =============================================================================
    // CONCLUSÕES E RECOMENDAÇÕES
    // =============================================================================
    console.log('\n\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║  🎯 CONCLUSÕES E RECOMENDAÇÕES                                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    console.log('📊 ESTRATÉGIAS POSSÍVEIS:\n');
    console.log('1. USAR ENDPOINT /estoque/{id}');
    console.log('   → Se retornar movimentações ou histórico');
    console.log('   → Fidelidade: ALTA\n');
    
    console.log('2. CALCULAR A PARTIR DE VENDAS');
    console.log('   → Saídas = SUM(quantidade vendida)');
    console.log('   → Estoque Inicial = Estoque Final + Saídas');
    console.log('   → Fidelidade: MÉDIA (não considera compras)\n');
    
    console.log('3. BUSCAR COMPRAS/NFEs + VENDAS');
    console.log('   → Entradas de endpoint de compras');
    console.log('   → Saídas de vendas');
    console.log('   → Fidelidade: ALTA\n');
    
    console.log('4. SNAPSHOT SIMPLES');
    console.log('   → Apenas Estoque Final (saldo atual)');
    console.log('   → Campos de movimentação = 0');
    console.log('   → Fidelidade: BAIXA (mas simples)\n');

  } catch (err) {
    console.error('❌ Erro:', err);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

investigar().catch(console.error);
