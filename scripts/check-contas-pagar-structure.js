const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 VERIFICANDO ESTRUTURA DOS DADOS\n');

  try {
    // Verificar quantos têm cliente vs fornecedor
    const rawPayloads = await prisma.rawPayload.findMany({
      where: { module: 'vw_contas_pagar' },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    });

    console.log(`Total de payloads: ${rawPayloads.length}\n`);

    let comCliente = 0;
    let comFornecedor = 0;
    let comAmbos = 0;
    let comNenhum = 0;

    const exemplos = {
      cliente: null,
      fornecedor: null,
    };

    rawPayloads.forEach(raw => {
      const conta = raw.payload;
      const temCliente = !!conta.cliente;
      const temFornecedor = !!conta.fornecedor;

      if (temCliente && temFornecedor) {
        comAmbos++;
      } else if (temCliente) {
        comCliente++;
        if (!exemplos.cliente) exemplos.cliente = conta;
      } else if (temFornecedor) {
        comFornecedor++;
        if (!exemplos.fornecedor) exemplos.fornecedor = conta;
      } else {
        comNenhum++;
      }
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ESTATÍSTICAS:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`   Apenas CLIENTE: ${comCliente}`);
    console.log(`   Apenas FORNECEDOR: ${comFornecedor}`);
    console.log(`   Ambos: ${comAmbos}`);
    console.log(`   Nenhum: ${comNenhum}\n`);

    if (exemplos.fornecedor) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📄 EXEMPLO COM FORNECEDOR:');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log(JSON.stringify(exemplos.fornecedor, null, 2));
    } else if (exemplos.cliente) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('⚠️  NÃO ENCONTRADO EXEMPLO COM FORNECEDOR!');
      console.log('📄 EXEMPLO COM CLIENTE:');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log(JSON.stringify(exemplos.cliente, null, 2));
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 CONCLUSÃO:');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (comFornecedor > 0) {
      console.log('✅ Existem contas com FORNECEDOR - Estrutura correta');
      console.log('   → Transformer deve buscar fornecedor.nome\n');
    } else if (comCliente > 0) {
      console.log('❌ TODOS os registros têm CLIENTE ao invés de FORNECEDOR!');
      console.log('   → Possível BUG: endpoint errado ou API Tiny usa nomenclatura diferente');
      console.log('   → CORREÇÃO: Transformer deve buscar cliente.nome para FORNECEDOR\n');
    }

    console.log('✅ VERIFICAÇÃO COMPLETA\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

check();
