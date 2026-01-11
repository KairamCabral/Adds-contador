/**
 * Funções de sincronização por módulo
 * Extraídas de jobs/sync.ts para reutilização no executor resumable
 */

// Re-exportar as funções de sync de cada módulo
// Estas funções já existem em jobs/sync.ts e serão importadas aqui

export { syncVendas } from "./sync";
export { syncContasReceberPosicao } from "./sync";
export { syncContasPagar } from "./sync";
export { syncContasPagas } from "./sync";
export { syncContasRecebidas } from "./sync";
export { syncEstoque } from "./sync";

export type { ModuleResult } from "./sync";
