/**
 * Métodos de acesso à API Tiny ERP V3
 * Swagger: https://api.tiny.com.br/public-api/v3/swagger
 * 
 * Endpoints V3:
 * - GET /pedidos - Lista pedidos
 * - GET /pedidos/{id} - Detalhe do pedido
 * - GET /contas-receber - Contas a receber
 * - GET /contas-pagar - Contas a pagar
 * - GET /produtos - Produtos
 * - GET /estoques - Estoque
 * - GET /contatos/{id} - Contato por ID
 */

import { TinyConnection } from "@prisma/client";
import { tinyRequest } from "./client";
import {
  TinyPaginatedResponse,
  TinyPedidoResumo,
  TinyPedidoDetalhe,
  TinyContaReceber,
  TinyContaPagar,
  TinyProduto,
  TinyContato,
  TinyPedidoSearchParams,
  TinyContaSearchParams,
} from "./types";

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Formata data para o padrão aceito pela API Tiny V3 (YYYY-MM-DD)
 */
const formatDateForTiny = (date: Date): string => {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Se for rate limit (429) ou erro de servidor (5xx), retry com backoff
      const isRetryable =
        lastError.message.includes("429") ||
        lastError.message.includes("500") ||
        lastError.message.includes("502") ||
        lastError.message.includes("503");

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(
        `[Tiny API] Retry ${attempt + 1}/${maxRetries} após ${delay}ms: ${lastError.message}`
      );
      await sleep(delay);
    }
  }

  throw lastError;
};

// ============================================
// PEDIDOS / VENDAS
// ============================================

/**
 * Lista pedidos com paginação
 * Endpoint V3: GET /pedidos
 */
export async function listPedidos(
  connection: TinyConnection,
  params: TinyPedidoSearchParams = {}
): Promise<TinyPaginatedResponse<TinyPedidoResumo>> {
  const query: Record<string, string | number | undefined> = {
    pagina: params.pagina ?? 1,
  };

  if (params.dataInicial) query.dataInicial = params.dataInicial;
  if (params.dataFinal) query.dataFinal = params.dataFinal;
  if (params.situacao) query.situacao = params.situacao;
  if (params.idCliente) query.idCliente = params.idCliente;

  return withRetry(() =>
    tinyRequest<TinyPaginatedResponse<TinyPedidoResumo>>({
      connection,
      path: "/pedidos",
      query,
    })
  );
}

/**
 * Busca detalhes de um pedido específico (com itens)
 * Endpoint V3: GET /pedidos/{id}
 */
export async function getPedido(
  connection: TinyConnection,
  pedidoId: number
): Promise<TinyPedidoDetalhe> {
  return withRetry(() =>
    tinyRequest<TinyPedidoDetalhe>({
      connection,
      path: `/pedidos/${pedidoId}`,
    })
  );
}

/**
 * Lista todos os pedidos em um período (com paginação automática)
 */
export async function listAllPedidos(
  connection: TinyConnection,
  dataInicial: Date,
  dataFinal: Date,
  situacao?: string
): Promise<TinyPedidoResumo[]> {const allPedidos: TinyPedidoResumo[] = [];
  let pagina = 1;
  let hasMore = true;

  console.log(
    `[Tiny] Buscando pedidos de ${formatDateForTiny(dataInicial)} a ${formatDateForTiny(dataFinal)}`
  );

  while (hasMore) {
    try {
      const response = await listPedidos(connection, {
        dataInicial: formatDateForTiny(dataInicial),
        dataFinal: formatDateForTiny(dataFinal),
        situacao,
        pagina,
      });if (response.itens && response.itens.length > 0) {
      allPedidos.push(...response.itens);
      console.log(
        `[Tiny] Pedidos página ${pagina}/${response.numero_paginas}: +${response.itens.length} (total: ${allPedidos.length})`
      );
      pagina++;
      hasMore = pagina <= response.numero_paginas;

      // Rate limit: pequeno delay entre páginas
      if (hasMore) await sleep(300);
    } else {
      hasMore = false;
    }
    } catch (error: unknown) {throw error;
    }
  }console.log(`[Tiny] Total de pedidos encontrados: ${allPedidos.length}`);
  return allPedidos;
}

// ============================================
// CONTAS A RECEBER
// ============================================

/**
 * Lista contas a receber com paginação
 * Endpoint V3: GET /contas-receber
 */
export async function listContasReceber(
  connection: TinyConnection,
  params: TinyContaSearchParams = {}
): Promise<TinyPaginatedResponse<TinyContaReceber>> {
  const query: Record<string, string | number | undefined> = {
    pagina: params.pagina ?? 1,
  };

  if (params.dataInicial) query.dataInicial = params.dataInicial;
  if (params.dataFinal) query.dataFinal = params.dataFinal;
  if (params.situacao) query.situacao = params.situacao;

  return withRetry(() =>
    tinyRequest<TinyPaginatedResponse<TinyContaReceber>>({
      connection,
      path: "/contas-receber",
      query,
    })
  );
}

/**
 * Lista todas as contas a receber em um período (com paginação automática)
 */
export async function listAllContasReceber(
  connection: TinyConnection,
  dataInicial: Date,
  dataFinal: Date,
  situacao?: string
): Promise<TinyContaReceber[]> {
  const allContas: TinyContaReceber[] = [];
  let pagina = 1;
  let hasMore = true;

  console.log(
    `[Tiny] Buscando contas a receber de ${formatDateForTiny(dataInicial)} a ${formatDateForTiny(dataFinal)}${situacao ? ` (${situacao})` : ""}`
  );

  while (hasMore) {
    const response = await listContasReceber(connection, {
      dataInicial: formatDateForTiny(dataInicial),
      dataFinal: formatDateForTiny(dataFinal),
      situacao,
      pagina,
    });

    if (response.itens && response.itens.length > 0) {
      allContas.push(...response.itens);
      console.log(
        `[Tiny] Contas receber página ${pagina}/${response.numero_paginas}: +${response.itens.length} (total: ${allContas.length})`
      );
      pagina++;
      hasMore = pagina <= response.numero_paginas;
      if (hasMore) await sleep(300);
    } else {
      hasMore = false;
    }
  }

  console.log(`[Tiny] Total de contas a receber: ${allContas.length}`);
  return allContas;
}

// ============================================
// CONTAS A PAGAR
// ============================================

/**
 * Lista contas a pagar com paginação
 * Endpoint V3: GET /contas-pagar
 */
export async function listContasPagar(
  connection: TinyConnection,
  params: TinyContaSearchParams = {}
): Promise<TinyPaginatedResponse<TinyContaPagar>> {
  const query: Record<string, string | number | undefined> = {
    pagina: params.pagina ?? 1,
  };

  if (params.dataInicial) query.dataInicial = params.dataInicial;
  if (params.dataFinal) query.dataFinal = params.dataFinal;
  if (params.situacao) query.situacao = params.situacao;

  return withRetry(() =>
    tinyRequest<TinyPaginatedResponse<TinyContaPagar>>({
      connection,
      path: "/contas-pagar",
      query,
    })
  );
}

/**
 * Lista todas as contas a pagar em um período (com paginação automática)
 */
export async function listAllContasPagar(
  connection: TinyConnection,
  dataInicial: Date,
  dataFinal: Date,
  situacao?: string
): Promise<TinyContaPagar[]> {const allContas: TinyContaPagar[] = [];
  let pagina = 1;
  let hasMore = true;

  console.log(
    `[Tiny] Buscando contas a pagar de ${formatDateForTiny(dataInicial)} a ${formatDateForTiny(dataFinal)}${situacao ? ` (${situacao})` : ""}`
  );

  while (hasMore) {
    const response = await listContasPagar(connection, {
      dataInicial: formatDateForTiny(dataInicial),
      dataFinal: formatDateForTiny(dataFinal),
      situacao,
      pagina,
    });if (response.itens && response.itens.length > 0) {
      allContas.push(...response.itens);
      console.log(
        `[Tiny] Contas pagar página ${pagina}/${response.numero_paginas}: +${response.itens.length} (total: ${allContas.length})`
      );
      pagina++;
      hasMore = pagina <= response.numero_paginas;
      if (hasMore) await sleep(300);
    } else {
      hasMore = false;
    }
  }

  console.log(`[Tiny] Total de contas a pagar: ${allContas.length}`);
  return allContas;
}

// ============================================
// PRODUTOS E ESTOQUE
// ============================================

/**
 * Lista produtos com paginação
 * Endpoint V3: GET /produtos
 */
export async function listProdutos(
  connection: TinyConnection,
  pagina = 1
): Promise<TinyPaginatedResponse<TinyProduto>> {
  return withRetry(() =>
    tinyRequest<TinyPaginatedResponse<TinyProduto>>({
      connection,
      path: "/produtos",
      query: { pagina },
    })
  );
}

/**
 * Lista todos os produtos (com paginação automática)
 * Usado para obter dados de estoque (saldo) de cada produto
 */
export async function listAllProdutos(
  connection: TinyConnection
): Promise<TinyProduto[]> {
  const allProdutos: TinyProduto[] = [];
  let pagina = 1;
  let hasMore = true;

  console.log(`[Tiny] Buscando todos os produtos (para estoque)...`);

  while (hasMore) {
    try {
      // Usar withRetry com mais tentativas e delay maior para rate limit
      const response = await withRetry(
        () => listProdutos(connection, pagina),
        5, // maxRetries aumentado de 3 para 5
        2000 // baseDelay aumentado de 1000ms para 2000ms
      );

      if (response.itens && response.itens.length > 0) {
        allProdutos.push(...response.itens);
        console.log(
          `[Tiny] Produtos página ${pagina}/${response.numero_paginas || "?"}: +${response.itens.length} (total: ${allProdutos.length})`
        );
        pagina++;
        hasMore = response.numero_paginas ? pagina <= response.numero_paginas : response.itens.length >= 50;
        // Delay maior entre páginas para evitar rate limit
        if (hasMore) await sleep(1000); // Aumentado de 300ms para 1000ms
      } else {
        hasMore = false;
      }
    } catch (err) {
      // Se falhar mesmo com retries, logar e parar
      console.error(`[Tiny] Erro ao buscar produtos página ${pagina}:`, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  console.log(`[Tiny] Total de produtos: ${allProdutos.length}`);
  return allProdutos;
}

// ============================================
// CONTATOS
// ============================================

/**
 * Busca contato por ID
 * Endpoint V3: GET /contatos/{id}
 */
export async function getContato(
  connection: TinyConnection,
  contatoId: number
): Promise<TinyContato> {
  return withRetry(() =>
    tinyRequest<TinyContato>({
      connection,
      path: `/contatos/${contatoId}`,
    })
  );
}

// ============================================
// SMOKE TEST (para diagnóstico)
// ============================================

export type SmokeTestResult = {
  success: boolean;
  apiBase: string;
  tests: {
    name: string;
    status: number | null;
    timeMs: number;
    count: number;
    sampleIds: (number | string)[];
    error?: string;
  }[];
};

/**
 * Executa teste rápido da conexão com a API Tiny
 * Retorna resultado sem expor tokens
 */
export async function runSmokeTest(
  connection: TinyConnection
): Promise<SmokeTestResult> {
  const { getTinyApiBase } = await import("./client");
  const apiBase = getTinyApiBase();

  const tests: SmokeTestResult["tests"] = [];

  // Teste 1: Pedidos
  const pedidosStart = Date.now();
  try {
    const result = await listPedidos(connection, { pagina: 1 });
    tests.push({
      name: "pedidos",
      status: 200,
      timeMs: Date.now() - pedidosStart,
      count: result.itens?.length ?? 0,
      sampleIds: (result.itens ?? []).slice(0, 3).map((p) => p.id),
    });
  } catch (error) {
    tests.push({
      name: "pedidos",
      status: null,
      timeMs: Date.now() - pedidosStart,
      count: 0,
      sampleIds: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Teste 2: Contas a Receber
  const receberStart = Date.now();
  try {
    const result = await listContasReceber(connection, { pagina: 1 });
    tests.push({
      name: "contas-receber",
      status: 200,
      timeMs: Date.now() - receberStart,
      count: result.itens?.length ?? 0,
      sampleIds: (result.itens ?? []).slice(0, 3).map((c) => c.id),
    });
  } catch (error) {
    tests.push({
      name: "contas-receber",
      status: null,
      timeMs: Date.now() - receberStart,
      count: 0,
      sampleIds: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Teste 3: Contas a Pagar
  const pagarStart = Date.now();
  try {
    const result = await listContasPagar(connection, { pagina: 1 });
    tests.push({
      name: "contas-pagar",
      status: 200,
      timeMs: Date.now() - pagarStart,
      count: result.itens?.length ?? 0,
      sampleIds: (result.itens ?? []).slice(0, 3).map((c) => c.id),
    });
  } catch (error) {
    tests.push({
      name: "contas-pagar",
      status: null,
      timeMs: Date.now() - pagarStart,
      count: 0,
      sampleIds: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const success = tests.every((t) => t.status === 200);

  return { success, apiBase, tests };
}

// ============================================
// ESTOQUE
// ============================================

export interface TinyEstoqueSearchParams {
  dataInicial?: string;
  dataFinal?: string;
  produtoId?: number;
  depositoId?: number;
  pagina?: number;
}

export interface TinyEstoqueItem {
  id: number;
  produto: {
    id: number;
    sku: string;
    descricao: string;
  };
  deposito: {
    id: number;
    nome: string;
  };
  saldo: number;
  saldoReservado?: number;
  dataUltimaMovimentacao?: string;
  custoMedio?: number;
  valorTotal?: number;
}

/**
 * Lista estoque (posição atual ou movimentações)
 */
export async function listEstoque(
  connection: TinyConnection,
  params: TinyEstoqueSearchParams = {}
): Promise<TinyPaginatedResponse<TinyEstoqueItem>> {
  const query: Record<string, string | number> = {
    pagina: params.pagina ?? 1,
  };

  if (params.produtoId) query.produtoId = params.produtoId;
  if (params.depositoId) query.depositoId = params.depositoId;
  if (params.dataInicial) query.dataInicial = params.dataInicial;
  if (params.dataFinal) query.dataFinal = params.dataFinal;

  return withRetry(() =>
    tinyRequest<TinyPaginatedResponse<TinyEstoqueItem>>({
      connection,
      path: "/estoques",
      query,
    })
  );
}

/**
 * Lista todo o estoque (snapshot completo - posição atual)
 */
export async function listAllEstoque(
  connection: TinyConnection
): Promise<TinyEstoqueItem[]> {
  const allItens: TinyEstoqueItem[] = [];
  let pagina = 1;
  let hasMore = true;

  console.log(`[Tiny] Buscando snapshot completo de estoque`);

  while (hasMore) {
    const response = await listEstoque(connection, { pagina });

    if (response.itens && response.itens.length > 0) {
      allItens.push(...response.itens);
      console.log(
        `[Tiny] Estoque página ${pagina}/${response.numero_paginas}: +${response.itens.length} (total: ${allItens.length})`
      );
      pagina++;
      hasMore = pagina <= response.numero_paginas;
      if (hasMore) await sleep(300);
    } else {
      hasMore = false;
    }
  }

  return allItens;
}
