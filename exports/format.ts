export const serializeValue = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  // Detectar Prisma Decimal sem importar runtime interno
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return value ?? "";
};

