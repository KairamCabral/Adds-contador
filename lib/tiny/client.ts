import { prisma } from "@/lib/db";
import {
  TinyConnection,
  Prisma,
} from "@prisma/client";

import { decryptSecret, encryptSecret } from "../crypto";
import { refreshAccessToken, TinyTokenResponse } from "./oauth";

const API_BASE =
  process.env.TINY_API_BASE?.replace(/\/$/, "") ?? "https://api.tiny.com.br";

const EXPIRY_BUFFER_MS = 60 * 1000; // renovar 1 min antes

type TinyRequestOptions = {
  connection: TinyConnection;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

const buildUrl = (path: string, query?: TinyRequestOptions["query"]) => {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const shouldRefresh = (expiresAt?: Date | null) => {
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() < EXPIRY_BUFFER_MS;
};

const persistTokenUpdate = async (
  connectionId: string,
  token: TinyTokenResponse,
) => {
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  const data: Prisma.TinyConnectionUpdateInput = {
    accessTokenEnc: encryptSecret(token.access_token),
    refreshTokenEnc: encryptSecret(token.refresh_token),
    expiresAt,
    scope: token.scope,
  };

  if (token.company_id) {
    data.accountId = token.company_id;
  }
  if (token.company_name) {
    data.accountName = token.company_name;
  }

  await prisma.tinyConnection.update({
    where: { id: connectionId },
    data,
  });

  return { expiresAt };
};

const ensureAccessToken = async (connection: TinyConnection) => {
  if (!connection.refreshTokenEnc || !connection.accessTokenEnc) {
    throw new Error("Conexão Tiny sem tokens armazenados");
  }

  const refreshToken = decryptSecret(connection.refreshTokenEnc);
  let accessToken = decryptSecret(connection.accessTokenEnc);
  let expiresAt = connection.expiresAt ?? null;

  if (shouldRefresh(expiresAt)) {
    const refreshed = await refreshAccessToken(refreshToken);
    const { expiresAt: newExpiry } = await persistTokenUpdate(
      connection.id,
      refreshed,
    );
    accessToken = refreshed.access_token;
    expiresAt = newExpiry;
  }

  return { accessToken, expiresAt };
};

export async function tinyRequest<T = unknown>({
  connection,
  path,
  method = "GET",
  body,
  query,
}: TinyRequestOptions): Promise<T> {
  const { accessToken } = await ensureAccessToken(connection);
  const url = buildUrl(path, query);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    // Tentar uma vez renovar e refazer a chamada
    const refreshed = await refreshAccessToken(
      decryptSecret(connection.refreshTokenEnc),
    );
    await persistTokenUpdate(connection.id, refreshed);
    const retry = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${refreshed.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Tiny API erro após refresh: ${retry.status} ${text}`);
    }
    return (await retry.json()) as T;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tiny API erro ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

