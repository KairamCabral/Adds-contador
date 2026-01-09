/**
 * Helpers para acessar campos com fallback entre camelCase e snake_case
 * Centraliza a lógica de normalização sem espalhar 'any' pelo código
 */

/**
 * Converte valor unknown para Record seguro
 */
export function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  return v as Record<string, unknown>;
}

/**
 * Busca o primeiro valor não-undefined de uma lista de chaves
 * @param obj - Objeto a ser pesquisado
 * @param keys - Lista de chaves alternativas (ex: ["valorUnitario", "valor_unitario"])
 * @returns Primeiro valor encontrado ou undefined
 */
export function getFirst<T = unknown>(
  obj: unknown,
  keys: string[]
): T | undefined {
  const record = asRecord(obj);
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (value !== undefined) {
      return value as T;
    }
  }
  
  return undefined;
}

/**
 * Busca valor seguindo múltiplos caminhos (paths) alternativos
 * @param obj - Objeto raiz
 * @param paths - Lista de caminhos alternativos (ex: [["cliente", "cpfCnpj"], ["cliente", "cpf_cnpj"]])
 * @returns Primeiro valor encontrado ou undefined
 */
export function getPathFirst<T = unknown>(
  obj: unknown,
  paths: Array<(string | number)[]>
): T | undefined {
  for (const path of paths) {
    let current: unknown = obj;
    
    for (const key of path) {
      const record = asRecord(current);
      if (!record) {
        current = undefined;
        break;
      }
      current = record[String(key)];
    }
    
    if (current !== undefined) {
      return current as T;
    }
  }
  
  return undefined;
}

/**
 * Busca string com fallback entre chaves alternativas
 */
export function getString(
  obj: unknown,
  keys: string[]
): string | undefined {
  const value = getFirst(obj, keys);
  if (value === null || value === undefined) return undefined;
  return String(value);
}

/**
 * Busca número com fallback entre chaves alternativas
 */
export function getNumber(
  obj: unknown,
  keys: string[]
): number | undefined {
  const value = getFirst(obj, keys);
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Busca array com fallback entre chaves alternativas
 */
export function getArray<T = unknown>(
  obj: unknown,
  keys: string[]
): T[] | undefined {
  const value = getFirst(obj, keys);
  if (!Array.isArray(value)) return undefined;
  return value as T[];
}
