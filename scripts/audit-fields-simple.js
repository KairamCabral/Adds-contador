/**
 * Auditoria simples: mostra amostras de valores para cada campo
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🔍 AUDITORIA DE CAMPOS - AMOSTRAS\n");

  // VW_VENDAS
  console.log("📊 vw_vendas");
  console.log("─".repeat(70));
  const vendas = await prisma.vwVendas.findMany({ take: 3 });
  if (vendas.length > 0) {
    const v = vendas[0];
    console.log(`Produto: "${v.produto}"`);
    console.log(`Categoria: "${v.categoria}"`);
    console.log(`Quantidade: ${v.quantidade}`);
    console.log(`Valor Unit: ${v.valorUnitario}`);
    console.log(`Valor Total: ${v.valorTotal}`);
    console.log(`Forma Pagto: "${v.formaPagamento}"`);
    console.log(`Vendedor: "${v.vendedor}"`);
    console.log(`Cliente: "${v.cliente}"`);
    console.log(`CNPJ Cliente: "${v.cnpjCliente}"`);
    console.log(`Caixa: "${v.caixa}"`);
    console.log(`Status: "${v.status}"`);
    console.log(`Total registros: ${await prisma.vwVendas.count()}`);
  } else {
    console.log("❌ SEM DADOS");
  }

  // VW_CONTAS_RECEBER_POSICAO
  console.log("\n📊 vw_contas_receber_posicao");
  console.log("─".repeat(70));
  const contasReceber = await prisma.vwContasReceberPosicao.findMany({ take: 3 });
  if (contasReceber.length > 0) {
    const c = contasReceber[0];
    console.log(`ID Titulo: ${c.tituloId}`);
    console.log(`Cliente: "${c.cliente}"`);
    console.log(`CNPJ: "${c.cnpj}"`);
    console.log(`Categoria: "${c.categoria}"`);
    console.log(`Centro Custo: "${c.centroCusto}"`);
    console.log(`Valor: ${c.valor}`);
    console.log(`Total registros: ${await prisma.vwContasReceberPosicao.count()}`);
  } else {
    console.log("❌ SEM DADOS");
  }

  // VW_CONTAS_PAGAR
  console.log("\n📊 vw_contas_pagar");
  console.log("─".repeat(70));
  const contasPagar = await prisma.vwContasPagar.findMany({ take: 3 });
  if (contasPagar.length > 0) {
    const c = contasPagar[0];
    console.log(`ID Titulo: ${c.tituloId}`);
    console.log(`Fornecedor: "${c.fornecedor}"`);
    console.log(`Categoria: "${c.categoria}"`);
    console.log(`Centro Custo: "${c.centroCusto}"`);
    console.log(`Valor: ${c.valor}`);
    console.log(`Status: "${c.status}"`);
    console.log(`Forma Pagto: "${c.formaPagto}"`);
    console.log(`Total registros: ${await prisma.vwContasPagar.count()}`);
  } else {
    console.log("❌ SEM DADOS");
  }

  console.log("\n" + "=".repeat(70));
  
  // Resumo de N/D
  const vendasND = await prisma.vwVendas.count({ where: { produto: "N/D" } });
  const vendasTotal = await prisma.vwVendas.count();
  console.log(`\n⚠️  VENDAS: ${vendasND}/${vendasTotal} com Produto = "N/D"`);

  const vendasZero = await prisma.vwVendas.count({ where: { valorTotal: 0 } });
  console.log(`⚠️  VENDAS: ${vendasZero}/${vendasTotal} com Valor Total = 0`);

  const contasReceberND = await prisma.vwContasReceberPosicao.count({ where: { cnpj: "N/D" } });
  const contasReceberTotal = await prisma.vwContasReceberPosicao.count();
  console.log(`\n⚠️  CONTAS RECEBER: ${contasReceberND}/${contasReceberTotal} com CNPJ = "N/D"`);

  const contasPagarND = await prisma.vwContasPagar.count({ where: { fornecedor: "N/D" } });
  const contasPagarTotal = await prisma.vwContasPagar.count();
  console.log(`⚠️  CONTAS PAGAR: ${contasPagarND}/${contasPagarTotal} com Fornecedor = "N/D"`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

