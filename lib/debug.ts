/**
 * Sistema de debug com logs sanitizados para desenvolvimento
 */

const DEBUG_ENABLED = process.env.DEBUG_TINY === "1";

/**
 * Mascara dados sensíveis (CPF, CNPJ, email, telefone)
 */
export function sanitizePII(obj: unknown): unknown {
  if (!obj) return obj;
  if (typeof obj !== "object") return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizePII(item));
  }

  // Handle objects - create typed copy
  const source = obj as Record<string, unknown>;
  const sanitized: Record<string, unknown> = { ...source };

  for (const key in sanitized) {
    if (!Object.prototype.hasOwnProperty.call(sanitized, key)) continue;
    
    const value = sanitized[key];

    // Mascarar CPF/CNPJ
    if (
      (key.toLowerCase().includes("cpf") ||
        key.toLowerCase().includes("cnpj")) &&
      typeof value === "string"
    ) {
      sanitized[key] = value.replace(/\d(?=\d{4})/g, "*");
      continue;
    }

    // Mascarar email
    if (key.toLowerCase().includes("email") && typeof value === "string") {
      const [user, domain] = value.split("@");
      if (domain) {
        sanitized[key] = `${user.substring(0, 2)}***@${domain}`;
      }
      continue;
    }

    // Mascarar telefone
    if (
      (key.toLowerCase().includes("tel") ||
        key.toLowerCase().includes("cel") ||
        key.toLowerCase().includes("fone")) &&
      typeof value === "string"
    ) {
      sanitized[key] = value.replace(/\d(?=\d{4})/g, "*");
      continue;
    }

    // Recursivo para objetos aninhados
    if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizePII(value);
    }
  }

  return sanitized;
}

/**
 * Log de debug com sanitização automática
 */
export function debugLog(module: string, message: string, data?: unknown) {
  if (!DEBUG_ENABLED) return;

  const sanitizedData = data ? sanitizePII(data) : undefined;

  console.log(`[DEBUG ${module}] ${message}`);
  if (sanitizedData !== undefined) {
    console.log(JSON.stringify(sanitizedData, null, 2));
  }
}

/**
 * Log de mapeamento: mostra dados originais vs transformados
 */
export function debugMapping(
  module: string,
  original: unknown,
  transformed: unknown,
  index: number = 0
) {
  if (!DEBUG_ENABLED || index > 0) return; // Só primeiro item

  console.log(`\n[DEBUG ${module}] MAPEAMENTO DO ITEM #${index + 1}:`);
  console.log("=".repeat(70));
  console.log("ORIGINAL (sanitizado):");
  console.log(JSON.stringify(sanitizePII(original), null, 2).substring(0, 1000));
  console.log("\nTRANSFORMADO:");
  console.log(JSON.stringify(transformed, null, 2).substring(0, 1000));
  console.log("=".repeat(70));
}

/**
 * Log de warning para valores suspeitos
 */
export function debugWarn(module: string, field: string, value: unknown, path: string) {
  if (!DEBUG_ENABLED) return;

  if (value === undefined || Number.isNaN(value) || value === "NaN") {
    console.warn(
      `[DEBUG ${module}] ⚠️  Campo "${field}" inválido: ${value} (path: ${path})`
    );
  }
}

