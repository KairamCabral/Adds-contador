import { prisma } from "@/lib/db";

/**
 * Retorna o companyId padrão (singleton)
 * Prioriza empresa com nome "ADDS Brasil", senão retorna a primeira
 */
export async function getDefaultCompanyId(): Promise<string | null> {
  // Tentar encontrar "ADDS Brasil" primeiro
  const addsBrasil = await prisma.company.findFirst({
    where: { name: "ADDS Brasil" },
    select: { id: true },
  });

  if (addsBrasil) {
    return addsBrasil.id;
  }

  // Fallback: primeira empresa do banco
  const firstCompany = await prisma.company.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return firstCompany?.id ?? null;
}

/**
 * Garante que o usuário tem acesso à empresa padrão
 * Retorna companyId se tiver acesso, senão null
 */
export async function getDefaultCompanyIdForUser(userId: string): Promise<string | null> {
  const companyId = await getDefaultCompanyId();
  
  if (!companyId) {
    return null;
  }

  // Verificar se usuário tem acesso
  const member = await prisma.companyMember.findFirst({
    where: {
      userId,
      companyId,
    },
  });

  return member ? companyId : null;
}

