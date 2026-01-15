import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

// Módulos disponíveis
const P0_MODULES = ["vw_contas_receber_posicao", "vw_contas_pagar"];
const P1_MODULES = ["vw_contas_pagas", "vw_contas_recebidas"];
const P2_MODULES = ["vw_estoque"];
const P3_MODULES = ["vw_vendas"];
const ALL_MODULES = [...P0_MODULES, ...P1_MODULES, ...P2_MODULES, ...P3_MODULES];

export async function POST(request: NextRequest) {
  const requestId = `v2-create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const session = await auth();

  if (!userHasRole(session, [Role.ADMIN, Role.OPERADOR])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { companyId, startDate, endDate, syncMode } = body;

    console.log(`[SyncV2 Create] START requestId=${requestId} companyId=${companyId}`);

    if (!companyId) {
      console.error(`[SyncV2 Create] ERROR requestId=${requestId} error="companyId missing"`);
      return NextResponse.json(
        { error: "companyId é obrigatório" },
        { status: 400 }
      );
    }

    // Determinar modo
    const mode = syncMode || (startDate && endDate ? "period" : "incremental");

    // Determinar módulos baseado no modo
    let modules = ALL_MODULES;
    if (mode === "period") {
      // Excluir apenas estoque (snapshot, não histórico)
      // Contas Pagas/Recebidas: buscar por vencimento e filtrar por data de pagamento
      modules = ALL_MODULES.filter(m => m !== "vw_estoque");
      console.log(`[SyncV2 Create] Modo período: ${modules.length} módulos. Lista: ${modules.join(", ")}`);
    }

    // Criar SyncRun
    const syncRun = await prisma.syncRun.create({
      data: {
        companyId,
        syncMode: mode,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: "QUEUED",
        modules,
        moduleIndex: 0,
        cursor: {},
        progressJson: {},
        triggeredByUserId: session?.user?.id || null,
      },
    });

    const range = startDate && endDate 
      ? `range=${new Date(startDate).toISOString().slice(0, 10)}..${new Date(endDate).toISOString().slice(0, 10)}`
      : "range=incremental";

    console.log(
      `[SyncV2 Create] ✓ RUN START runId=${syncRun.id} mode=${mode} ${range} modules=[${modules.join(", ")}]`
    );

    return NextResponse.json({
      success: true,
      runId: syncRun.id,
      modules,
      mode,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro ao criar sync";
    console.error(`[SyncV2 Create] ERROR requestId=${requestId} error="${errorMessage}"`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
