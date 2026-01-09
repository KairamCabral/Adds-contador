import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import { runSync } from "@/jobs/sync";

const isCronRequest = (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
};

export async function POST(request: NextRequest) {const session = await auth();
  const cron = isCronRequest(request);

  if (!cron && !userHasRole(session, [Role.ADMIN, Role.OPERADOR])) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData().catch(() => null);
    if (form) {
      body = Object.fromEntries(form.entries());
    }
  }

  const companyId = body?.companyId as string | undefined;try {
    const result = await runSync({
      companyId,
      triggeredByUserId: session?.user?.id,
      isCron: cron,
    });return NextResponse.json({ ok: true, runIds: result.runIds });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;throw error;
  }
}

