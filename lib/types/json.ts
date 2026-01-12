/**
 * Tipos utilitários para JSON seguro (sem any)
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// Interface permite recursão sem referência circular
export interface JsonObject {
  [key: string]: JsonValue;
}

// Tipo genérico para Records com unknown
export type JsonRecord = Record<string, unknown>;
