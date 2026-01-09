import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { reports, ReportView } from "@/app/relatorios/config";
import { buildJson } from "@/exports/json";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { RoleAssignment } from "@/types/next-auth";

import { fetchRowsForExport } from "../utils";

const unauthorized = () =>
  NextResponse.json({ error: "Não autorizado" }, { status: 403 });

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const view = pathname.split("/").pop()?.split(".")[0] as ReportView;

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

  if (!(session.user.companies as RoleAssignment[]).some((c) => c.companyId === companyId)) {
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

  const rows = await fetchRowsForExport(view, filters);const buffer = await buildJson(view, rows);

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      companyId,
      action: "EXPORT",
      metadata: { view, format: "JSON", filters },
    },
  });

  return new Response(buffer.toString("utf-8"), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${view}.json"`,
    },
  });
}

