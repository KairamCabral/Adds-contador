const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.vwVendas.deleteMany({})
  .then(result => {
    console.log(`✅ Deletados ${result.count} registros de vw_vendas`);
    console.log('📌 Agora sincronize novamente para popular com dados corretos');
    prisma.$disconnect();
  })
  .catch(err => {
    console.error('❌ Erro:', err.message);
    prisma.$disconnect();
  });
