import crypto from "crypto";

// Tiny usa Keycloak/OIDC (Tiny agora é Olist)
const AUTH_BASE =
  process.env.TINY_AUTH_BASE?.replace(/\/$/, "") ?? "https://accounts.tiny.com.br";

const AUTHORIZE_URL = `${AUTH_BASE}/realms/tiny/protocol/openid-connect/auth`;
const TOKEN_URL = `${AUTH_BASE}/realms/tiny/protocol/openid-connect/token`;

type OAuthStatePayload = {
  companyId: string;
  ts: number;
  sig: string;
};

const STATE_TTL_MS = 10 * 60 * 1000;

const getStateSecret = () =>
  process.env.AUTH_SECRET ?? process.env.ENCRYPTION_MASTER_KEY ?? "";

const signPayload = (payload: Omit<OAuthStatePayload, "sig">) => {
  const hmac = crypto.createHmac("sha256", getStateSecret());
  hmac.update(JSON.stringify(payload));
  return hmac.digest("hex");
};

export function createOAuthState(companyId: string): string {
  const payload = { companyId, ts: Date.now() };
  const sig = signPayload(payload);
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString("base64url");
}

export function parseOAuthState(state: string): { companyId: string } {
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    const { companyId, ts, sig } = decoded;
    if (!companyId || !ts || !sig) {
      throw new Error("state inválido");
    }
    const expected = signPayload({ companyId, ts });
    if (expected !== sig) {
      throw new Error("state inválido");
    }
    if (Date.now() - ts > STATE_TTL_MS) {
      throw new Error("state expirado");
    }
    return { companyId };
  } catch {
    throw new Error("state inválido");
  }
}

export type TinyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  company_id?: string;
  company_name?: string;
};

const getClient = () => {
  const clientId = process.env.TINY_CLIENT_ID;
  const clientSecret = process.env.TINY_CLIENT_SECRET;
  const redirectUri = process.env.TINY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Variáveis TINY_CLIENT_ID/SECRET/REDIRECT_URI ausentes");
  }

  return { clientId, clientSecret, redirectUri };
};

export function buildAuthorizeUrl(state: string, scope?: string) {
  const { clientId, redirectUri } = getClient();
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/tiny/oauth.ts:76',message:'buildAuthorizeUrl called',data:{authBase:AUTH_BASE,authorizeUrl:AUTHORIZE_URL,clientId:clientId.substring(0,20)+'...',redirectUri,state:state.substring(0,20)+'...'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F,G,H'})}).catch(()=>{});
  // #endregion
  
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  if (scope) {
    url.searchParams.set("scope", scope);
  }
  return url.toString();
}

export async function exchangeCodeForToken(
  code: string,
): Promise<TinyTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getClient();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao trocar código por token: ${text}`);
  }

  return (await response.json()) as TinyTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TinyTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getClient();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao renovar token: ${text}`);
  }

  return (await response.json()) as TinyTokenResponse;
}

