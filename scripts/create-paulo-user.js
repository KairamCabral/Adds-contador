/**
 * Script para criar usuário Paulo
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createPauloUser() {
  console.log("🔧 Criando usuário Paulo...\n");

  const email = "paulo@iskcontabilidade.com";
  const password = "Contador@01!";
  const name = "Paulo";
  const role = "CONTADOR";
  
  // Verificar se já existe
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log("⚠️  Usuário já existe!");
    console.log(`   ID: ${existing.id}`);
    console.log(`   Nome: ${existing.name}`);
    console.log(`   Email: ${existing.email}\n`);
    
    // Atualizar senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hashedPassword },
    });
    
    console.log("✅ Senha atualizada!");
    return;
  }
  
  // Gerar hash da senha
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  console.log("Senha:", password);
  console.log("Hash gerado:", hashedPassword.substring(0, 20) + "...\n");

  // Criar usuário
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      name,
    },
  });
  
  console.log("✅ Usuário criado!");
  console.log(`   ID: ${user.id}`);
  console.log(`   Nome: ${user.name}`);
  console.log(`   Email: ${user.email}\n`);
  
  // Buscar empresa padrão (ADDS Brasil)
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  
  if (company) {
    // Atribuir role CONTADOR
    await prisma.userCompanyRole.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role,
      },
    });
    console.log(`✅ Role ${role} atribuído para empresa: ${company.name}\n`);
  } else {
    console.log("⚠️  Nenhuma empresa encontrada. Crie uma empresa primeiro.\n");
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 CREDENCIAIS DE LOGIN:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Email:    ${email}`);
  console.log(`Senha:    ${password}`);
  console.log(`Role:     ${role}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

createPauloUser()
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
