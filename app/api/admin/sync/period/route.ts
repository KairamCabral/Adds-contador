import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { runSync } from "@/jobs/sync";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!userHasRole(session, [Role.ADMIN, Role.OPERADOR])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { companyId, startDate, endDate } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId é obrigatório" },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate e endDate são obrigatórios" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Datas inválidas" },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: "Data inicial não pode ser maior que data final" },
        { status: 400 }
      );
    }

    console.log(
      `[Sync Period] Sincronizando ${companyId} de ${start.toISOString()} até ${end.toISOString()}`
    );

    const result = await runSync({
      companyId,
      triggeredByUserId: session?.user?.id,
      isCron: false,
      startDate: start,
      endDate: end,
    });

    return NextResponse.json({ ok: true, runIds: result.runIds });
  } catch (error: any) {
    console.error("[Sync Period] Erro:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro ao sincronizar" },
      { status: 500 }
    );
  }
}

