/**
 * Helpers robustos para normalização de números
 * Garante que NUNCA retorna NaN/Infinity para o Prisma
 */

const DEBUG = process.env.DEBUG_SYNC === "1";

/**
 * Parse número brasileiro para float
 * Aceita: number, string BR ("1.234,56"), "R$ 1.234,56", null, undefined
 * NUNCA retorna NaN - fallback para 0
 */
export function parseNumberBR(input: unknown, fallback = 0): number {
  // Já é número válido
  if (typeof input === "number") {
    if (isNaN(input) || !isFinite(input)) {
      if (DEBUG) console.warn(`[parseNumberBR] Invalid number: ${input}, using fallback: ${fallback}`);
      return fallback;
    }
    return input;
  }

  // Null/undefined -> fallback
  if (input == null) {
    return fallback;
  }

  // String
  if (typeof input === "string") {
    // Remover espaços e símbolos monetários
    let cleaned = input.trim()
      .replace(/^R\$\s*/, "")
      .replace(/\s/g, "");

    // Se vazio após limpeza
    if (cleaned === "" || cleaned === "-") {
      return fallback;
    }

    // Detectar formato BR: tem vírgula como decimal
    if (cleaned.includes(",")) {
      // Formato BR: "1.234,56" ou "1234,56"
      // Remover pontos (milhares) e trocar vírgula por ponto
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }

    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed) || !isFinite(parsed)) {
      if (DEBUG) console.warn(`[parseNumberBR] Could not parse "${input}", using fallback: ${fallback}`);
      return fallback;
    }

    return parsed;
  }

  // Tipo inesperado
  if (DEBUG) console.warn(`[parseNumberBR] Unexpected type ${typeof input}: ${input}, using fallback: ${fallback}`);
  return fallback;
}

/**
 * Converte para Prisma Decimal (string numérica)
 * GARANTIA: nunca retorna NaN ou Infinity
 */
export function toPrismaDecimal(input: unknown, fallback = 0): string {
  const num = parseNumberBR(input, fallback);
  
  // Validação extra (paranoia)
  if (isNaN(num) || !isFinite(num)) {
    console.error(`[toPrismaDecimal] CRITICAL: parseNumberBR returned invalid: ${num}, forcing 0`);
    return "0";
  }

  // Retornar como string com 2 casas decimais
  return num.toFixed(2);
}

/**
 * Garantir texto obrigatório com fallback
 */
export function assertRequiredText(value: unknown, fallback = "N/D"): string {
  if (value == null || value === "") {
    return fallback;
  }
  return String(value).trim() || fallback;
}

/**
 * Parse data segura
 * Se inválida, retorna fallback (hoje, ou null se allowNull=true)
 */
export function safeDate(input: unknown, allowNull = false): Date | null {
  if (input == null) {
    return allowNull ? null : new Date();
  }

  const date = input instanceof Date ? input : new Date(input as string);
  
  if (isNaN(date.getTime())) {
    if (DEBUG) console.warn(`[safeDate] Invalid date: ${input}, using fallback`);
    return allowNull ? null : new Date();
  }

  return date;
}

/**
 * Validar número antes de enviar ao Prisma (última linha de defesa)
 */
export function validateDecimalField(value: unknown, fieldName: string, recordId: string): string {
  const result = toPrismaDecimal(value);
  
  // Paranoia: se ainda for NaN (impossível, mas...)
  if (result === "NaN" || result === "Infinity" || result === "-Infinity") {
    console.error(`[CRITICAL] ${fieldName} for ${recordId} is still invalid: ${result}, forcing 0`);
    return "0";
  }

  return result;
}

