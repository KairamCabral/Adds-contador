/**
 * Validação de configuração do sistema
 * Verifica env vars obrigatórias e retorna erros amigáveis
 */

export const REQUIRED_ENV_VARS = {
  database: ["DATABASE_URL"],
  auth: ["AUTH_SECRET"],
  encryption: ["ENCRYPTION_MASTER_KEY"],
  tiny: ["TINY_CLIENT_ID", "TINY_CLIENT_SECRET", "TINY_REDIRECT_URI"],
  sync: ["CRON_SECRET"],
} as const;

export type EnvValidationResult = {
  valid: boolean;
  missing: string[];
  warnings: string[];
};

/**
 * Valida se todas as variáveis de ambiente obrigatórias estão configuradas
 */
export function validateEnvVars(
  categories: (keyof typeof REQUIRED_ENV_VARS)[] = [
    "database",
    "auth",
    "encryption",
    "tiny",
  ]
): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const category of categories) {
    for (const varName of REQUIRED_ENV_VARS[category]) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
  }

  // Verificar formato do ENCRYPTION_MASTER_KEY
  if (process.env.ENCRYPTION_MASTER_KEY) {
    try {
      const buf = Buffer.from(process.env.ENCRYPTION_MASTER_KEY, "base64");
      if (buf.length !== 32) {
        warnings.push(
          "ENCRYPTION_MASTER_KEY deve ter 32 bytes (base64). Use: openssl rand -base64 32"
        );
      }
    } catch {
      warnings.push("ENCRYPTION_MASTER_KEY não está em formato base64 válido");
    }
  }

  // Verificar formato do TINY_REDIRECT_URI
  if (process.env.TINY_REDIRECT_URI) {
    if (!process.env.TINY_REDIRECT_URI.includes("/api/tiny/callback")) {
      warnings.push(
        "TINY_REDIRECT_URI deve terminar em /api/tiny/callback"
      );
    }
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.TINY_REDIRECT_URI.startsWith("https://")
    ) {
      warnings.push("TINY_REDIRECT_URI deve usar HTTPS em produção");
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Retorna a configuração de lookback de sync
 */
export function getSyncConfig() {
  const initialLookbackDays = parseInt(
    process.env.SYNC_LOOKBACK_DAYS ?? "90",
    10
  );
  const incrementalLookbackDays = parseInt(
    process.env.SYNC_INCREMENTAL_DAYS ?? "7",
    10
  );

  return {
    initialLookbackDays: isNaN(initialLookbackDays) ? 90 : initialLookbackDays,
    incrementalLookbackDays: isNaN(incrementalLookbackDays)
      ? 7
      : incrementalLookbackDays,
  };
}

/**
 * Retorna informações de configuração sem expor secrets
 */
export function getSafeConfig() {
  return {
    tinyApiBase:
      process.env.TINY_API_BASE ?? "https://erp.tiny.com.br/public-api/v3",
    tinyAuthBase: process.env.TINY_AUTH_BASE ?? "https://accounts.tiny.com.br",
    tinyRedirectUri: process.env.TINY_REDIRECT_URI ?? "not_configured",
    tinyClientId: process.env.TINY_CLIENT_ID
      ? `${process.env.TINY_CLIENT_ID.substring(0, 8)}...`
      : "not_configured",
    hasEncryptionKey: !!process.env.ENCRYPTION_MASTER_KEY,
    hasCronSecret: !!process.env.CRON_SECRET,
    syncConfig: getSyncConfig(),
  };
}

