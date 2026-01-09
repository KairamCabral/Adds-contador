/**
 * Serializa valor para Excel (mantém tipos nativos)
 */
export const serializeValueForExcel = (value: unknown) => {
  // Datas: manter como Date para Excel formatar
  if (value instanceof Date) {
    return value;
  }
  
  // Detectar Prisma Decimal e converter para número
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  
  // Números: manter como número
  if (typeof value === "number") {
    return value;
  }
  
  return value ?? "";
};

/**
 * Serializa valor para JSON (formato pt-BR)
 */
export const serializeValue = (value: unknown) => {
  // Datas: formato DD/MM/AAAA HH:MM:SS
  if (value instanceof Date) {
    return value.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  
  // Detectar Prisma Decimal sem importar runtime interno
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    const num = (value as { toNumber: () => number }).toNumber();
    // Números: formato pt-BR com vírgula
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  // Números regulares: formato pt-BR
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  return value ?? "";
};

