import { Decimal } from "@prisma/client/runtime/library";

export const serializeValue = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Decimal) {
    return value.toNumber();
  }
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

