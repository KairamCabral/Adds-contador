import { NextRequest, NextResponse } from "next/server";

import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { exchangeCodeForToken, parseOAuthState } from "@/lib/tiny/oauth";

const successRedirect = (req: NextRequest, companyId: string) =>
  NextResponse.redirect(
    new URL(
      `/admin/conexoes-tiny?status=connected&companyId=${companyId}`,
      req.url,
    ),
  );

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return errorResponse("Parâmetros code/state ausentes");
  }

  let companyId: string;
  try {
    const parsed = parseOAuthState(state);
    companyId = parsed.companyId;
  } catch {
    return errorResponse("State inválido", 400);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    const data = {
      companyId,
      accessTokenEnc: encryptSecret(token.access_token),
      refreshTokenEnc: encryptSecret(token.refresh_token),
      expiresAt,
      scope: token.scope,
      accountId: token.company_id,
      accountName: token.company_name,
    };

    const existing = await prisma.tinyConnection.findFirst({
      where: { companyId },
      select: { id: true },
    });

    if (existing) {
      await prisma.tinyConnection.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.tinyConnection.create({ data });
    }

    return successRedirect(request, companyId);
  } catch {
    return errorResponse("Erro ao processar callback Tiny", 500);
  }
}

