import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { listPedidos, listContasReceber, listContasPagar } from "@/lib/tiny/api";

/**
 * Smoke Test endpoint - faz chamadas leves à API Tiny para verificar conectividade
 * GET /api/admin/tiny/smoke?companyId=<UUID>
 * 
 * Retorna contagens e tempos de resposta para diagnóstico rápido
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN])) {
    return NextResponse.json({ error: "Acesso negado - ADMIN apenas" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId é obrigatório" },
      { status: 400 },
    );
  }

  // Buscar TinyConnection
  const connection = await prisma.tinyConnection.findFirst({
    where: { companyId },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Conexão Tiny não encontrada para esta empresa" },
      { status: 404 },
    );
  }

  const results: Record<string, unknown> = {};

  // Teste 1: Pedidos (1 página)
  try {
    const start = Date.now();
    const pedidos = await listPedidos(connection, { pagina: 1 });
    const end = Date.now();
    results.pedidos = {
      status: "OK",
      count: pedidos.itens?.length ?? 0,
      totalPages: pedidos.numero_paginas ?? 0,
      sampleIds: pedidos.itens?.slice(0, 3).map((p) => p.id),
      timeMs: end - start,
    };
  } catch (error: unknown) {
    const err = error as Error;
    results.pedidos = { 
      status: "FAILED", 
      error: err.message,
      hint: "Verifique se o token não expirou e se a API Tiny está respondendo"
    };
  }

  // Teste 2: Contas a Receber (1 página)
  try {
    const start = Date.now();
    const contasReceber = await listContasReceber(connection, { pagina: 1 });
    const end = Date.now();
    results.contasReceber = {
      status: "OK",
      count: contasReceber.itens?.length ?? 0,
      totalPages: contasReceber.numero_paginas ?? 0,
      sampleIds: contasReceber.itens?.slice(0, 3).map((c) => c.id),
      timeMs: end - start,
    };
  } catch (error: unknown) {
    const err = error as Error;
    results.contasReceber = { 
      status: "FAILED", 
      error: err.message,
      hint: "Verifique permissões do app no Tiny para módulo Financeiro"
    };
  }

  // Teste 3: Contas a Pagar (1 página)
  try {
    const start = Date.now();
    const contasPagar = await listContasPagar(connection, { pagina: 1 });
    const end = Date.now();
    results.contasPagar = {
      status: "OK",
      count: contasPagar.itens?.length ?? 0,
      totalPages: contasPagar.numero_paginas ?? 0,
      sampleIds: contasPagar.itens?.slice(0, 3).map((c) => c.id),
      timeMs: end - start,
    };
  } catch (error: unknown) {
    const err = error as Error;
    results.contasPagar = { 
      status: "FAILED", 
      error: err.message,
      hint: "Verifique permissões do app no Tiny para módulo Financeiro"
    };
  }

  // Resumo geral
  const allOk = Object.values(results).every(
    (r) => typeof r === 'object' && r !== null && 'status' in r && r.status === "OK"
  );

  return NextResponse.json({
    company: { id: companyId },
    connection: { 
      id: connection.id, 
      connectedAt: connection.connectedAt 
    },
    tests: results,
    summary: {
      status: allOk ? "ALL_OK" : "PARTIAL_FAILURE",
      timestamp: new Date().toISOString(),
    },
  });
}
