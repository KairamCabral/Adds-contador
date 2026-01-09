/**
 * Script para regenerar senha do admin
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function fixAdminPassword() {
  console.log("🔧 Regenerando senha do admin...\n");

  // Nova senha
  const newPassword = "Adds@2024!";
  
  // Gerar hash
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  console.log("Senha:", newPassword);
  console.log("Hash gerado:", hashedPassword.substring(0, 20) + "...\n");

  // Atualizar no banco
  const result = await prisma.user.updateMany({
    where: { email: "admin@adds.com.br" },
    data: { passwordHash: hashedPassword },
  });

  if (result.count > 0) {
    console.log("✅ Senha atualizada com sucesso!");
    console.log(`   Usuários atualizados: ${result.count}`);
    console.log("\nCredenciais de login:");
    console.log("   Email: admin@adds.com.br");
    console.log("   Senha: Adds@2024!");
  } else {
    console.log("❌ Usuário admin@adds.com.br não encontrado!");
    console.log("\nCriando novo usuário admin...");
    
    const user = await prisma.user.create({
      data: {
        email: "admin@adds.com.br",
        passwordHash: hashedPassword,
        name: "Administrador",
      },
    });
    
    console.log("✅ Usuário criado:", user.id);
    
    // Buscar empresa padrão
    const company = await prisma.company.findFirst();
    
    if (company) {
      // Atribuir role ADMIN
      await prisma.userCompanyRole.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: "ADMIN",
        },
      });
      console.log("✅ Role ADMIN atribuído para empresa:", company.name);
    }
  }
}

fixAdminPassword()
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

