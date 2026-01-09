/**
 * Sistema de enrichment para buscar dados complementares da API Tiny
 * Usa cache em memória para reduzir chamadas à API
 */

import { TinyConnection } from "@prisma/client";
import { tinyRequest } from "./client";

// Cache em memória por execução de sync
const cacheByConnection = new Map<string, EnrichmentCache>();

interface EnrichmentCache {
  produtos: Map<number, CachedProduto>;
  pessoas: Map<number, CachedPessoa>;
  categorias: Map<number, CachedCategoria>;
}

interface CachedProduto {
  id: number;
  sku: string;
  descricao: string;
  categoria?: {
    id: number;
    nome: string;
  };
  unidade?: string;
  preco?: number;
}

interface CachedPessoa {
  id: number;
  nome: string;
  cpfCnpj?: string;
  tipo: string;
}

interface CachedCategoria {
  id: number;
  nome: string;
}

/**
 * Obtem cache para uma conexão específica
 */
function getCache(connectionId: string): EnrichmentCache {
  if (!cacheByConnection.has(connectionId)) {
    cacheByConnection.set(connectionId, {
      produtos: new Map(),
      pessoas: new Map(),
      categorias: new Map(),
    });
  }
  return cacheByConnection.get(connectionId)!;
}

/**
 * Limpa cache de uma conexão
 */
export function clearCache(connectionId?: string) {
  if (connectionId) {
    cacheByConnection.delete(connectionId);
  } else {
    cacheByConnection.clear();
  }
}

/**
 * Busca informações de um produto (com categoria)
 */
export async function getProduto(
  connection: TinyConnection,
  produtoId: number
): Promise<CachedProduto | null> {
  const cache = getCache(connection.id);

  // Verifica cache
  if (cache.produtos.has(produtoId)) {
    return cache.produtos.get(produtoId)!;
  }

  try {
    const response = await tinyRequest<any>({
      connection,
      path: `/produtos/${produtoId}`,
    });

    const produto: CachedProduto = {
      id: produtoId,
      sku: response.codigo || response.sku || "",
      descricao: response.descricao || response.nome || "",
      categoria: response.categoria?.id
        ? {
            id: response.categoria.id,
            nome: response.categoria.nome || "Sem categoria",
          }
        : undefined,
      unidade: response.unidade,
      preco: response.preco,
    };

    // Salvar no cache
    cache.produtos.set(produtoId, produto);

    return produto;
  } catch (error) {
    console.warn(`[Enrichment] Falha ao buscar produto ${produtoId}:`, error);
    return null;
  }
}

/**
 * Busca informações de uma pessoa (cliente/fornecedor)
 */
export async function getPessoa(
  connection: TinyConnection,
  pessoaId: number
): Promise<CachedPessoa | null> {
  const cache = getCache(connection.id);

  // Verifica cache
  if (cache.pessoas.has(pessoaId)) {
    return cache.pessoas.get(pessoaId)!;
  }

  try {
    const response = await tinyRequest<any>({
      connection,
      path: `/contatos/${pessoaId}`,
    });

    const pessoa: CachedPessoa = {
      id: pessoaId,
      nome: response.nome || "",
      cpfCnpj: response.cpf_cnpj || response.cpfCnpj || undefined,
      tipo: response.tipo_pessoa || response.tipoPessoa || "F",
    };

    // Salvar no cache
    cache.pessoas.set(pessoaId, pessoa);

    return pessoa;
  } catch (error) {
    console.warn(`[Enrichment] Falha ao buscar pessoa ${pessoaId}:`, error);
    return null;
  }
}

/**
 * Busca categoria pelo ID
 */
export async function getCategoria(
  connection: TinyConnection,
  categoriaId: number
): Promise<CachedCategoria | null> {
  const cache = getCache(connection.id);

  // Verifica cache
  if (cache.categorias.has(categoriaId)) {
    return cache.categorias.get(categoriaId)!;
  }

  try {
    const response = await tinyRequest<any>({
      connection,
      path: `/categorias/${categoriaId}`,
    });

    const categoria: CachedCategoria = {
      id: categoriaId,
      nome: response.nome || response.descricao || "",
    };

    // Salvar no cache
    cache.categorias.set(categoriaId, categoria);

    return categoria;
  } catch (error) {
    console.warn(
      `[Enrichment] Falha ao buscar categoria ${categoriaId}:`,
      error
    );
    return null;
  }
}

/**
 * Estatísticas do cache
 */
export function getCacheStats(connectionId: string) {
  const cache = getCache(connectionId);
  return {
    produtos: cache.produtos.size,
    pessoas: cache.pessoas.size,
    categorias: cache.categorias.size,
  };
}

