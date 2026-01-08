/**
 * Endpoint de Smoke Test para validar conexão Tiny
 * GET /api/admin/tiny/smoke?companyId=...
 * 
 * Apenas ADMIN pode acessar
 * Retorna resultado de teste sem expor tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { runSmokeTest, SmokeTestResult } from "@/lib/tiny/api";

// Validação de env vars obrigatórias
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "ENCRYPTION_MASTER_KEY",
  "TINY_CLIENT_ID",
  "TINY_CLIENT_SECRET",
  "TINY_REDIRECT_URI",
];

function validateEnvVars(): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  return { valid: missing.length === 0, missing };
}

export async function GET(request: NextRequest) {
  // Verificar autenticação e autorização
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Verificar env vars
  const envCheck = validateEnvVars();
  if (!envCheck.valid) {
    return NextResponse.json(
      {
        error: "Configuração incompleta",
        missing: envCheck.missing,
        hint: "Configure as variáveis de ambiente na Vercel",
      },
      { status: 500 }
    );
  }

  // Obter companyId
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId é obrigatório" },
      { status: 400 }
    );
  }

  // Buscar conexão Tiny
  const connection = await prisma.tinyConnection.findFirst({
    where: { companyId },
  });

  if (!connection) {
    return NextResponse.json(
      {
        error: "TinyConnection não encontrada",
        hint: "Conecte a empresa ao Tiny em /admin/conexoes-tiny",
        companyId,
      },
      { status: 404 }
    );
  }

  // Executar smoke test
  try {
    const result: SmokeTestResult = await runSmokeTest(connection);

    return NextResponse.json({
      success: result.success,
      companyId,
      accountName: connection.accountName,
      accountId: connection.accountId,
      apiBase: result.apiBase,
      redirectUri: process.env.TINY_REDIRECT_URI,
      tests: result.tests,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Smoke Test] Erro:", message);

    return NextResponse.json(
      {
        success: false,
        companyId,
        error: message,
        hint: "Verifique se o token OAuth está válido e os escopos corretos",
      },
      { status: 500 }
    );
  }
}

