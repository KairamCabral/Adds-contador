/**
 * Tipos utilitários para JSON seguro (sem any)
 */

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export type JsonObject = Record<string, JsonValue>;
export type JsonRecord = Record<string, unknown>;
