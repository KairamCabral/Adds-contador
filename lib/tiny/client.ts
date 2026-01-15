/**
 * Cliente HTTP para API Tiny ERP V3
 * Base URL: https://api.tiny.com.br/public-api/v3
 */

import { prisma } from "@/lib/db";
import { TinyConnection, Prisma } from "@prisma/client";

import { decryptSecret, encryptSecret } from "../crypto";
import { refreshAccessToken, TinyTokenResponse } from "./oauth";

// URL base da API Tiny V3 (Tiny agora é Olist)
const API_BASE =
  process.env.TINY_API_BASE?.replace(/\/$/, "") ??
  "https://erp.tiny.com.br/public-api/v3";

const EXPIRY_BUFFER_MS = 60 * 1000; // renovar 1 min antes

export type TinyRequestOptions = {
  connection: TinyConnection;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

export type TinyRequestLog = {
  endpoint: string;
  method: string;
  status: number;
  timeMs: number;
  error?: string;
};

const buildUrl = (path: string, query?: TinyRequestOptions["query"]) => {
  // Se o path já começa com /, usar diretamente, senão adicionar /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE}${normalizedPath}`);
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
  token: TinyTokenResponse
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
    console.log("[Tiny] Renovando token expirado...");
    const refreshed = await refreshAccessToken(refreshToken);
    const { expiresAt: newExpiry } = await persistTokenUpdate(
      connection.id,
      refreshed
    );
    accessToken = refreshed.access_token;
    expiresAt = newExpiry;
    console.log("[Tiny] Token renovado com sucesso");
  }

  return { accessToken, expiresAt };
};

/**
 * Faz uma requisição à API Tiny V3 com tratamento de token e logging
 */
export async function tinyRequest<T = unknown>({
  connection,
  path,
  method = "GET",
  body,
  query,
}: TinyRequestOptions): Promise<T> {const startTime = Date.now();
  const { accessToken } = await ensureAccessToken(connection);
  const url = buildUrl(path, query);

  // Log seguro (sem token)
  const logEndpoint = url.replace(/access_token=[^&]+/, "access_token=***");
  console.log(`[Tiny API] ${method} ${logEndpoint}`);

  // Timeout de 30 segundos por request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {throw new Error(`Timeout na requisição para ${path} (> 30s)`);
    }
    throw err;
  }

  const timeMs = Date.now() - startTime;// Log de resposta
  console.log(`[Tiny API] ${method} ${path} → ${response.status} (${timeMs}ms)`);

  if (response.status === 401) {
    console.log("[Tiny API] Token inválido, tentando refresh...");
    try {
      // Tentar uma vez renovar e refazer a chamada
      const refreshed = await refreshAccessToken(
        decryptSecret(connection.refreshTokenEnc)
      );
      await persistTokenUpdate(connection.id, refreshed);

      const retryStart = Date.now();
      const retry = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${refreshed.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const retryTime = Date.now() - retryStart;
      console.log(
        `[Tiny API] Retry ${method} ${path} → ${retry.status} (${retryTime}ms)`
      );

      if (!retry.ok) {
        const text = await retry.text();
        throw new Error(`Tiny API erro após refresh: ${retry.status} ${text}`);
      }
      return (await retry.json()) as T;
    } catch (refreshError) {
      const errorMsg = refreshError instanceof Error ? refreshError.message : String(refreshError);
      console.error("[Tiny API] Erro ao renovar token:", errorMsg);
      
      // Mensagem amigável para usuário
      if (errorMsg.includes("invalid_grant") || errorMsg.includes("Token is not active")) {
        throw new Error(
          "Sessão Tiny expirada. Por favor, reconecte sua conta em Admin > Conexões Tiny."
        );
      }
      throw new Error(`Falha ao renovar token: ${errorMsg}`);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`[Tiny API] Erro: ${response.status} - ${text.substring(0, 200)}`);throw new Error(`Tiny API erro ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/**
 * Retorna a URL base configurada para a API Tiny
 */
export function getTinyApiBase(): string {
  return API_BASE;
}
