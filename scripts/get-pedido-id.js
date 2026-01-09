const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.vwVendas.findFirst({
  orderBy: { dataHora: 'desc' }
}).then(venda => {
  if (venda) {
    // ID formato: "companyId_pedidoId" ou "companyId_pedidoId_itemIdx"
    const parts = venda.id.split('_');
    const pedidoId = parts[1]; // pedidoId é sempre a segunda parte
    console.log(pedidoId);
  } else {
    console.log('Nenhuma venda encontrada');
  }
  prisma.$disconnect();
}).catch(err => {
  console.error(err.message);
  prisma.$disconnect();
});
