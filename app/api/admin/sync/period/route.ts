import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { runSync } from "@/jobs/sync";

export async function POST(request: NextRequest) {
  const requestId = `period-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  const session = await auth();

  if (!userHasRole(session, [Role.ADMIN, Role.OPERADOR])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { companyId, startDate, endDate } = body;

    console.log(`[HTTP] /sync/period START requestId=${requestId} companyId=${companyId || 'undefined'}`);

    if (!companyId) {
      console.error(`[HTTP] /sync/period ERROR requestId=${requestId} error="companyId missing"`);
      return NextResponse.json(
        { error: "companyId é obrigatório" },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      console.error(`[HTTP] /sync/period ERROR requestId=${requestId} error="dates missing"`);
      return NextResponse.json(
        { error: "startDate e endDate são obrigatórios" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error(`[HTTP] /sync/period ERROR requestId=${requestId} error="invalid dates"`);
      return NextResponse.json(
        { error: "Datas inválidas" },
        { status: 400 }
      );
    }

    if (start > end) {
      console.error(`[HTTP] /sync/period ERROR requestId=${requestId} error="start > end"`);
      return NextResponse.json(
        { error: "Data inicial não pode ser maior que data final" },
        { status: 400 }
      );
    }

    console.log(
      `[HTTP] /sync/period EXEC requestId=${requestId} companyId=${companyId} startDate=${start.toISOString()} endDate=${end.toISOString()} mode=period (sem enrichment)`
    );

    const result = await runSync({
      companyId,
      triggeredByUserId: session?.user?.id,
      isCron: false,
      startDate: start,
      endDate: end,
      syncMode: "period", // CRÍTICO: pular enrichment de produtos em sync de período
    });

    const durationMs = Date.now() - startTime;
    console.log(
      `[HTTP] /sync/period END requestId=${requestId} status=success runIds=${result.runIds.length} durationMs=${durationMs}`
    );

    return NextResponse.json({ ok: true, runIds: result.runIds });
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Erro ao sincronizar";
    console.error(`[HTTP] /sync/period ERROR requestId=${requestId} durationMs=${durationMs} error="${errorMessage}"`);
    console.error("[HTTP] /sync/period STACK:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

