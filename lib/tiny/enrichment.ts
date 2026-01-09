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
    const response = await tinyRequest<unknown>({
      connection,
      path: `/produtos/${produtoId}`,
    });

    // Type assertion - response da API Tiny
    const produtoData = response as Record<string, unknown>;

    const produto: CachedProduto = {
      id: produtoId,
      sku: String(produtoData.codigo || produtoData.sku || ""),
      descricao: String(produtoData.descricao || produtoData.nome || ""),
      categoria: 
        produtoData.categoria && 
        typeof produtoData.categoria === 'object' && 
        produtoData.categoria !== null &&
        'id' in produtoData.categoria
        ? {
            id: Number((produtoData.categoria as Record<string, unknown>).id),
            nome: String((produtoData.categoria as Record<string, unknown>).nome || "Sem categoria"),
          }
        : undefined,
      unidade: produtoData.unidade ? String(produtoData.unidade) : undefined,
      preco: produtoData.preco ? Number(produtoData.preco) : undefined,
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
    const response = await tinyRequest<unknown>({
      connection,
      path: `/contatos/${pessoaId}`,
    });

    // Type assertion - response da API Tiny
    const pessoaData = response as Record<string, unknown>;

    const pessoa: CachedPessoa = {
      id: pessoaId,
      nome: String(pessoaData.nome || ""),
      cpfCnpj: pessoaData.cpf_cnpj || pessoaData.cpfCnpj ? String(pessoaData.cpf_cnpj || pessoaData.cpfCnpj) : undefined,
      tipo: String(pessoaData.tipo_pessoa || pessoaData.tipoPessoa || "F"),
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
    const response = await tinyRequest<unknown>({
      connection,
      path: `/categorias/${categoriaId}`,
    });

    // Type assertion - response da API Tiny
    const categoriaData = response as Record<string, unknown>;

    const categoria: CachedCategoria = {
      id: categoriaId,
      nome: String(categoriaData.nome || categoriaData.descricao || ""),
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

