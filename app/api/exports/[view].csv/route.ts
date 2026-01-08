import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { reports, ReportView } from "@/app/relatorios/config";
import { buildCsv } from "@/exports/csv";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

import { fetchRowsForExport } from "../utils";

const unauthorized = () =>
  NextResponse.json({ error: "Não autorizado" }, { status: 403 });

export async function GET(
  request: NextRequest,
  // Next 16: tipo de params para segment com extensão ([view].csv) vira `{}`; ignoramos e extraímos do pathname
) {
  const match = request.nextUrl.pathname.match(/\/api\/exports\/(.+)\.csv$/);
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
  const buffer = await buildCsv(view, rows);

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
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=\"${view}.csv\"`,
    },
  });
}

