import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { reports, ReportView } from "@/app/relatorios/config";
import { buildXlsx } from "@/exports/xlsx";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

import { fetchRowsForExport } from "../utils";

const unauthorized = () =>
  NextResponse.json({ error: "Não autorizado" }, { status: 403 });

export async function GET(
  request: NextRequest,
  // Next 16: tipo de params para segment com extensão ([view].xlsx) vira `{}`; ignoramos e extraímos do pathname
) {
  const match = request.nextUrl.pathname.match(/\/api\/exports\/(.+)\.xlsx$/);
  const view = (match?.[1] ?? "") as ReportView;
  if (!reports[view]) {
    return NextResponse.json({ error: "View inválida" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) return unauthorized();
  if (!userHasRole(session, [Role.ADMIN, Role.CONTADOR, Role.OPERADOR])) {
    return unauthorized();
  }

  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get("companyId") ?? undefined;
  if (!companyId) {
    return NextResponse.json(
      { error: "companyId é obrigatório" },
      { status: 400 },
    );
  }

  const companies = session.user.companies as Array<{ companyId: string }>;
  if (!companies.some((c) => c.companyId === companyId)) {
    return unauthorized();
  }

  const filters = {
    companyId,
    start: searchParams.get("start") ?? undefined,
    end: searchParams.get("end") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: Number(searchParams.get("limit") ?? "5000"),
  };

  const rows = await fetchRowsForExport(view, filters);
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/exports/[view].xlsx/route.ts',message:'Exportação XLSX',data:{view,totalRows:rows.length,companyId,filters},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H_EXPORT_XLSX'})}).catch(()=>{});
  // #endregion
  
  const buffer = await buildXlsx(view, rows);

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      companyId,
      action: "EXPORT",
      metadata: { view, filters },
    },
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${view}.xlsx\"`,
    },
  });
}

