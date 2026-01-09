/**
 * Auditoria de campos: N/D vs Preenchidos
 * Para cada view, verifica quantos registros têm valores reais vs fallback
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const VIEWS = {
  vwVendas: [
    "dataHora", "produto", "categoria", "quantidade", "valorUnitario", 
    "valorTotal", "formaPagamento", "vendedor", "cliente", "cnpjCliente", 
    "caixa", "status"
  ],
  vwContasReceberPosicao: [
    "tituloId", "cliente", "cnpj", "categoria", "centroCusto", 
    "dataEmissao", "dataVencimento", "valor", "dataPosicao"
  ],
  vwContasPagar: [
    "tituloId", "fornecedor", "categoria", "centroCusto", "dataEmissao", 
    "dataVencimento", "valor", "status", "formaPagto"
  ],
};

async function auditView(viewName, fields) {
  const model = prisma[viewName];
  const total = await model.count();
  
  if (total === 0) {
    console.log(`\n❌ ${viewName}: SEM DADOS (0 registros)`);
    return;
  }

  console.log(`\n📊 ${viewName}: ${total} registros`);
  console.log("─".repeat(70));

  for (const field of fields) {
    const sample = await model.findFirst({
      select: { [field]: true },
    });
    
    const value = sample ? sample[field] : null;
    
    // Contar quantos são N/D ou 0
    let ndCount = 0;
    let zeroCount = 0;
    let nullCount = 0;
    let filledCount = 0;

    if (typeof value === "string") {
      ndCount = await model.count({
        where: { [field]: { in: ["N/D", ""] } },
      });
      nullCount = await model.count({
        where: { [field]: null },
      });
      filledCount = total - ndCount - nullCount;
    } else if (typeof value === "number" || value?.constructor?.name === "Prisma.Decimal") {
      zeroCount = await model.count({
        where: { [field]: 0 },
      });
      nullCount = await model.count({
        where: { [field]: null },
      });
      filledCount = total - zeroCount - nullCount;
    } else {
      nullCount = await model.count({
        where: { [field]: null },
      });
      filledCount = total - nullCount;
    }

    const status = filledCount === total ? "✅" : filledCount > 0 ? "⚠️ " : "❌";
    
    console.log(
      `${status} ${field.padEnd(20)} | Preenchidos: ${filledCount.toString().padStart(4)} | N/D: ${ndCount.toString().padStart(4)} | Zero: ${zeroCount.toString().padStart(4)} | Null: ${nullCount.toString().padStart(4)}`
    );
  }
}

async function main() {
  console.log("🔍 AUDITORIA DE CAMPOS - PORTAL DO CONTADOR\n");
  console.log("Legenda:");
  console.log("  ✅ = 100% preenchido");
  console.log("  ⚠️  = Parcialmente preenchido");
  console.log("  ❌ = 0% preenchido (todos N/D/0/null)\n");

  for (const [viewName, fields] of Object.entries(VIEWS)) {
    await auditView(viewName, fields);
  }

  console.log("\n" + "=".repeat(70));
  console.log("FIM DA AUDITORIA");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

