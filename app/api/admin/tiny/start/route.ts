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
  const url = buildAuthorizeUrl(state, scope);

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/tiny/start/route.ts:34',message:'OAuth URL generated',data:{companyId,url,state},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F,G,H'})}).catch(()=>{});
  // #endregion

  return NextResponse.json({ url });
}

