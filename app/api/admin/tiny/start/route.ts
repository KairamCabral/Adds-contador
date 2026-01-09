import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/tiny/oauth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const companyId = body?.companyId as string | undefined;
  const scope = body?.scope as string | undefined;

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId é obrigatório" },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const state = createOAuthState(companyId);
  const url = buildAuthorizeUrl(state, scope);return NextResponse.json({ url });
}

