const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        roles: {
          select: {
            role: true,
          }
        }
      }
    });

    console.log('\n📋 USUÁRIOS NO SISTEMA:\n');
    users.forEach(u => {
      console.log(`- Email: ${u.email}`);
      console.log(`  Nome: ${u.name}`);
      console.log(`  Roles: ${u.roles.map(r => r.role).join(', ')}`);
      console.log(`  Ativo: ${u.active ? '✅' : '❌'}`);
      console.log();
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
