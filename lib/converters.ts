/**
 * Conversores robustos que NUNCA retornam NaN
 */

import { Prisma } from "@prisma/client";

/**
 * Converte para Decimal string, NUNCA NaN
 */
export function toDecimal(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // Se já é Decimal do Prisma
  if (typeof value === "object" && "toNumber" in value) {
    const num = (value as { toNumber: () => number }).toNumber();
    if (isNaN(num) || !isFinite(num)) return null;
    return num.toString();
  }

  // Se é número
  if (typeof value === "number") {
    if (isNaN(value) || !isFinite(value)) return null;
    return value.toString();
  }

  // Se é string
  if (typeof value === "string") {
    // Remove R$, espaços, etc
    let cleaned = value.replace(/[R$\s]/g, "");

    // Formato brasileiro: 1.234,56 -> 1234.56
    if (cleaned.includes(",")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }

    const num = parseFloat(cleaned);
    if (isNaN(num) || !isFinite(num)) return null;
    return num.toString();
  }

  return null;
}

/**
 * Converte para Prisma.Decimal, com fallback para 0
 */
export function toPrismaDecimal(value: unknown, fallback: number = 0): Prisma.Decimal {
  const decimal = toDecimal(value);
  return new Prisma.Decimal(decimal ?? fallback.toString());
}

/**
 * Converte para inteiro
 */
export function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Converte para Date, aceita múltiplos formatos
 */
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    // ISO: YYYY-MM-DD ou YYYY-MM-DD HH:mm:ss
    if (value.includes("-")) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    // BR: DD/MM/YYYY
    if (value.includes("/")) {
      const parts = value.split("/");
      if (parts.length === 3) {
        const [day, month, year] = parts.map((p) => parseInt(p, 10));
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
      }
    }
  }

  return null;
}

/**
 * Retorna o primeiro valor não vazio
 */
export function pickFirst(...values: unknown[]): string {
  for (const val of values) {
    if (val !== null && val !== undefined && val !== "") {
      return String(val).trim();
    }
  }
  return "-";
}

/**
 * Texto seguro (trim, nunca undefined)
 */
export function safeText(value: unknown, fallback: string = "-"): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value).trim() || fallback;
}

/**
 * Extrai valor de objeto aninhado de forma segura
 * Ex: safeGet(obj, "cliente.cpfCnpj") ou safeGet(obj, ["cliente", "cpfCnpj"])
 */
export function safeGet(obj: unknown, path: string | string[]): unknown {
  if (!obj) return undefined;

  const keys = Array.isArray(path) ? path : path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

