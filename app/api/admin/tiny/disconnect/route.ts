import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!userHasRole(session, [Role.ADMIN])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se a empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { connections: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 404 }
      );
    }

    // Deletar todas as conexões da empresa
    await prisma.tinyConnection.deleteMany({
      where: { companyId },
    });

    console.log(`[Admin] Desconectado Tiny ERP para empresa ${company.name}`);

    return NextResponse.json({ 
      ok: true, 
      message: "Desconectado com sucesso" 
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro ao desconectar";
    console.error("[Admin] Erro ao desconectar:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
