/**
 * Métodos de acesso à API Tiny ERP V3
 * Endpoints baseados em: https://api.tiny.com.br/swagger
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
  TinyEstoque,
  TinyContato,
  TinyPedidoSearchParams,
  TinyContaSearchParams,
} from "./types";

// ============================================
// UTILITÁRIOS
// ============================================

const formatDateForTiny = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
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
        lastError.message.includes("5");

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(
        `[Tiny API] Retry ${attempt + 1}/${maxRetries} após ${delay}ms`
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
      path: "/api3/pedidos",
      query,
    })
  );
}

/**
 * Busca detalhes de um pedido específico (com itens)
 */
export async function getPedido(
  connection: TinyConnection,
  pedidoId: number
): Promise<TinyPedidoDetalhe> {
  return withRetry(() =>
    tinyRequest<TinyPedidoDetalhe>({
      connection,
      path: `/api3/pedidos/${pedidoId}`,
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
): Promise<TinyPedidoResumo[]> {
  const allPedidos: TinyPedidoResumo[] = [];
  let pagina = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await listPedidos(connection, {
      dataInicial: formatDateForTiny(dataInicial),
      dataFinal: formatDateForTiny(dataFinal),
      situacao,
      pagina,
    });

    if (response.itens && response.itens.length > 0) {
      allPedidos.push(...response.itens);
      pagina++;
      hasMore = pagina <= response.numero_paginas;

      // Rate limit: pequeno delay entre páginas
      if (hasMore) await sleep(200);
    } else {
      hasMore = false;
    }
  }

  return allPedidos;
}

// ============================================
// CONTAS A RECEBER
// ============================================

/**
 * Lista contas a receber com paginação
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
      path: "/api3/contas.receber",
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

  while (hasMore) {
    const response = await listContasReceber(connection, {
      dataInicial: formatDateForTiny(dataInicial),
      dataFinal: formatDateForTiny(dataFinal),
      situacao,
      pagina,
    });

    if (response.itens && response.itens.length > 0) {
      allContas.push(...response.itens);
      pagina++;
      hasMore = pagina <= response.numero_paginas;
      if (hasMore) await sleep(200);
    } else {
      hasMore = false;
    }
  }

  return allContas;
}

// ============================================
// CONTAS A PAGAR
// ============================================

/**
 * Lista contas a pagar com paginação
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
      path: "/api3/contas.pagar",
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
): Promise<TinyContaPagar[]> {
  const allContas: TinyContaPagar[] = [];
  let pagina = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await listContasPagar(connection, {
      dataInicial: formatDateForTiny(dataInicial),
      dataFinal: formatDateForTiny(dataFinal),
      situacao,
      pagina,
    });

    if (response.itens && response.itens.length > 0) {
      allContas.push(...response.itens);
      pagina++;
      hasMore = pagina <= response.numero_paginas;
      if (hasMore) await sleep(200);
    } else {
      hasMore = false;
    }
  }

  return allContas;
}

// ============================================
// PRODUTOS E ESTOQUE
// ============================================

/**
 * Lista produtos com paginação
 */
export async function listProdutos(
  connection: TinyConnection,
  pagina = 1
): Promise<TinyPaginatedResponse<TinyProduto>> {
  return withRetry(() =>
    tinyRequest<TinyPaginatedResponse<TinyProduto>>({
      connection,
      path: "/api3/produtos",
      query: { pagina },
    })
  );
}

/**
 * Lista estoque atual
 */
export async function listEstoque(
  connection: TinyConnection,
  pagina = 1
): Promise<TinyPaginatedResponse<TinyEstoque>> {
  return withRetry(() =>
    tinyRequest<TinyPaginatedResponse<TinyEstoque>>({
      connection,
      path: "/api3/estoques",
      query: { pagina },
    })
  );
}

// ============================================
// CONTATOS
// ============================================

/**
 * Busca contato por ID
 */
export async function getContato(
  connection: TinyConnection,
  contatoId: number
): Promise<TinyContato> {
  return withRetry(() =>
    tinyRequest<TinyContato>({
      connection,
      path: `/api3/contatos/${contatoId}`,
    })
  );
}

