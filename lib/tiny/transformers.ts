/**
 * Transformers: Tiny API → Tabelas vw_*
 * Mapeamento de campos e derivação de valores ausentes
 */

import { Prisma } from "@prisma/client";
import {
  TinyPedidoResumo,
  TinyPedidoItem,
  TinyPedidoDetalhe,
} from "./types";
import {
  toDecimal,
  toPrismaDecimal,
  toDate,
  safeText,
  pickFirst,
  safeGet,
} from "@/lib/converters";
import { getFirst, getPathFirst } from "./field";

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Gera ID único para upsert (companyId + externalId)
 */
const generateId = (companyId: string, externalId: number | string): string => {
  return `${companyId}_${externalId}`;
};

/**
 * Converte valor unknown para Record seguro (null se não for objeto)
 */
const asRecord = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== 'object') return null;
  return v as Record<string, unknown>;
};

/**
 * Unwrap pedido detalhe que pode vir envolvido em wrappers
 * Detecta automaticamente a estrutura correta procurando por campos-chave
 */
const unwrapPedidoDetalhe = (input: unknown): Record<string, unknown> => {
  const obj = asRecord(input);
  if (!obj) return {};
  
  // Se já tem 'itens' ou 'numero' ou 'cliente' na raiz, está correto
  if (obj.itens || obj.numero || obj.numeroPedido || obj.cliente) {
    return obj;
  }
  
  // Tentar unwrap comum: response.pedido
  if (obj.pedido && asRecord(obj.pedido)) {
    const pedido = asRecord(obj.pedido);
    if (pedido && (pedido.itens || pedido.numero || pedido.cliente)) {
      return pedido;
    }
  }
  
  // Tentar unwrap: response.retorno.pedido
  if (obj.retorno && asRecord(obj.retorno)) {
    const retorno = asRecord(obj.retorno);
    if (retorno?.pedido && asRecord(retorno.pedido)) {
      return asRecord(retorno.pedido) || {};
    }
  }
  
  // Retornar original se não detectar wrapper
  return obj;
};

/**
 * Unwrap pedido resumo
 */
const unwrapPedidoResumo = (input: unknown): Record<string, unknown> => {
  const obj = asRecord(input);
  if (!obj) return {};
  
  // Se já tem 'id' ou 'numero' na raiz, está correto
  if (obj.id || obj.numero) {
    return obj;
  }
  
  // Tentar unwrap
  if (obj.pedido && asRecord(obj.pedido)) {
    return asRecord(obj.pedido) || {};
  }
  
  return obj;
};

/**
 * Extrai array de itens do detalhe (suporta múltiplas estruturas)
 */
const extractItens = (detalhe: Record<string, unknown>): Record<string, unknown>[] => {
  // Tentar acessos diretos
  if (Array.isArray(detalhe.itens)) return detalhe.itens as Record<string, unknown>[];
  if (Array.isArray(detalhe.items)) return detalhe.items as Record<string, unknown>[];
  
  // Tentar estrutura aninhada { itens: { item: [...] } }
  const itensObj = asRecord(detalhe.itens);
  if (itensObj && Array.isArray(itensObj.item)) {
    return itensObj.item as Record<string, unknown>[];
  }
  
  // Tentar pedido.itens
  const pedidoObj = asRecord(detalhe.pedido);
  if (pedidoObj) {
    if (Array.isArray(pedidoObj.itens)) return pedidoObj.itens as Record<string, unknown>[];
    const itensNested = asRecord(pedidoObj.itens);
    if (itensNested && Array.isArray(itensNested.item)) {
      return itensNested.item as Record<string, unknown>[];
    }
  }
  
  return [];
};

/**
 * Normaliza status para texto amigável
 */
const normalizeStatus = (raw: unknown): string => {
  if (raw === undefined || raw === null) return "Desconhecido";
  
  // Se já é string, tentar extrair número de "SITUACAO_X" ou mapear
  if (typeof raw === 'string') {
    // Tentar extrair número de padrões como "SITUACAO_7", "SITUAÇÃO 7", etc
    const situacaoMatch = raw.match(/SITUA[CÇ][AÃ]O[_\s]*(\d+)/i);
    if (situacaoMatch) {
      const num = parseInt(situacaoMatch[1], 10);
      // Mapear o número extraído
      const numMap: Record<number, string> = {
        0: 'Cancelado',
        1: 'Aprovado',
        2: 'Cancelado',
        3: 'Atendido',
        4: 'Preparando envio',
        5: 'Faturado',
        6: 'Pronto para envio',
        7: 'Pronto para envio',
      };
      return numMap[num] || 'Pronto para envio';
    }
    
    // Mapear strings legíveis conhecidas
    const lower = raw.toLowerCase().trim();
    const statusMap: Record<string, string> = {
      'aprovado': 'Aprovado',
      'faturado': 'Faturado',
      'concluido': 'Concluído',
      'concluída': 'Concluído',
      'cancelado': 'Cancelado',
      'cancelada': 'Cancelado',
      'estornado': 'Estornado',
      'estornada': 'Estornado',
      'em aberto': 'Em aberto',
      'atendido': 'Atendido',
      'preparando envio': 'Preparando envio',
      'pronto para envio': 'Pronto para envio',
    };
    return statusMap[lower] || raw;
  }
  
  // Se é número, mapear diretamente
  if (typeof raw === 'number') {
    const numMap: Record<number, string> = {
      0: 'Cancelado',
      1: 'Aprovado',
      2: 'Cancelado',
      3: 'Atendido',
      4: 'Preparando envio',
      5: 'Faturado',
      6: 'Pronto para envio',
      7: 'Pronto para envio',
    };
    return numMap[raw] || 'Concluído';
  }
  
  return 'Status desconhecido';
};

// ============================================
// VW_VENDAS (de Pedidos)
// ============================================

export type VwVendasInput = Prisma.VwVendasCreateInput;


/**
 * Transforma pedido DETALHE completo em linhas de vw_vendas
 * Baseado na estrutura REAL da API Tiny V3
 * Fonte: GET /public-api/v3/pedidos/{id}
 * 
 * @param enrichData - Opcional: { produtos: Map<id, {categoria}> } para enriquecer categorias
 */
export function transformPedidoDetalheToVendas(
  companyId: string,
  detalhe: TinyPedidoDetalhe,
  enrichData?: { produtos?: Map<number, unknown> }
): VwVendasInput[] {
  // Normalizar detalhe (unwrap se necessário)
  const d = unwrapPedidoDetalhe(detalhe);
  
  // ========== EXTRAIR CAMPOS COMUNS ==========
  
  // Data: múltiplos fallbacks (API Tiny v3 não fornece hora, apenas data)
  const dataStr = getFirst<string>(d, [
    "data", "data_pedido", "dataPedido",
    "dataFaturamento", "data_faturamento",
    "dataEmissao", "data_emissao"
  ]);
  
  const dataHora = toDate(dataStr) ?? new Date();
  
  // Número do pedido (NUNCA undefined)
  const numPedidoRaw = getFirst<string | number>(d, [
    "numeroPedido", "numero_pedido", "numero",
    "id", "pedidoId", "pedido_id"
  ]);
  const numeroPedido = numPedidoRaw !== undefined && numPedidoRaw !== null 
    ? String(numPedidoRaw) 
    : String(d.id || "0");
  
  // Cliente
  const clienteRaw = getPathFirst(d, [
    ["cliente", "nome"],
    ["nome_cliente"]
  ]) as string;
  const cliente = safeText(clienteRaw, "Cliente não identificado");
  
  // CPF/CNPJ do cliente
  const cnpjRaw = getPathFirst(d, [
    ["cliente", "cpfCnpj"],
    ["cliente", "cpf_cnpj"],
    ["cliente", "documento"],
    ["cpf_cnpj"]
  ]) as string;
  const cnpjCliente = safeText(cnpjRaw) || "";
  
  // Vendedor
  const vendedorRaw = getPathFirst(d, [
    ["vendedor", "nome"],
    ["nome_vendedor"]
  ]) as string;
  const vendedor = safeText(vendedorRaw) || "-";
  
  // Forma de pagamento (tentar múltiplos caminhos)
  const formaPagtoRaw = getPathFirst(d, [
    ["pagamento", "formaPagamento", "nome"],
    ["pagamento", "forma_pagamento", "nome"],
    ["formaPagamento", "nome"],
    ["forma_pagamento"]
  ]) as string;
  const meioPagtoRaw = getPathFirst(d, [
    ["pagamento", "meioPagamento", "nome"],
    ["pagamento", "meio_pagamento", "nome"],
    ["meioPagamento", "nome"],
    ["meio_pagamento"]
  ]) as string;
  
  const formaPagto = safeText(formaPagtoRaw);
  const meioPagto = safeText(meioPagtoRaw);
  
  let formaPagamento = "N/D";
  if (formaPagto && formaPagto !== "-") {
    if (meioPagto && meioPagto !== "-") {
      formaPagamento = `${formaPagto} (${meioPagto})`;
    } else {
      formaPagamento = formaPagto;
    }
  } else if (meioPagto && meioPagto !== "-") {
    formaPagamento = meioPagto;
  }

  // Caixa (prioridade: ecommerce > deposito > meio > pdv/caixa)
  const caixaNomes = [
    getPathFirst(d, [["ecommerce", "nome"]]) as string,
    getPathFirst(d, [["deposito", "nome"]]) as string,
    meioPagtoRaw,
    getFirst<string>(d, ["pdv", "caixa", "numero_caixa"])
  ];
  const caixa = caixaNomes.map(n => safeText(n)).find(n => n && n !== "-") || "N/D";

  // Status (normalizado) - API Tiny retorna situacao como número
  const situacaoRaw = getFirst<string | number>(d, [
    "situacao",           // Número do status (prioridade)
    "situacaoCodigo",     // Fallback
    "status"              // Fallback genérico
  ]);
  const status = normalizeStatus(situacaoRaw);
  
  // Extrair itens (suporta múltiplas estruturas)
  const itens = extractItens(d);
  
  // ========== CASO: PEDIDO SEM ITENS ==========
  if (itens.length === 0) {
    const valorTotalRaw = getFirst(d, [
      "valorTotalPedido", "valor_total_pedido", "total", "valor"
    ]);
    const valorTotal = toPrismaDecimal(valorTotalRaw, 0);
    
    return [{
      id: generateId(companyId, d.id as number),
      company: { connect: { id: companyId } },
      dataHora,
      produto: `Pedido #${numeroPedido}`,
      categoria: "N/D",
      quantidade: toPrismaDecimal(1),
      valorUnitario: valorTotal,
      valorTotal,
      formaPagamento,
      vendedor,
      cliente,
      cnpjCliente,
      caixa,
      status,
    }];
  }

  // ========== CASO: PEDIDO COM ITENS ==========
  return itens.map((item: Record<string, unknown>, idx: number) => {
    // Quantidade
    const qtdRaw = getFirst(item, ["quantidade", "qtd", "qtde"]);
    const quantidade = toPrismaDecimal(qtdRaw, 0);
    
    // Valor unitário
    const vlrUnitRaw = getFirst(item, [
      "valorUnitario", "valor_unitario",
      "preco", "preco_unitario", "valor"
    ]);
    const valorUnitario = toPrismaDecimal(vlrUnitRaw, 0);
    
    // Valor total (preferir do item, senão calcular)
    const vlrTotalRaw = getFirst(item, [
      "valorTotal", "valor_total", "total", "valor_total_item"
    ]);
    const valorTotal = vlrTotalRaw 
      ? toPrismaDecimal(vlrTotalRaw, 0)
      : toPrismaDecimal(parseFloat(toDecimal(qtdRaw) ?? "0") * parseFloat(toDecimal(vlrUnitRaw) ?? "0"), 0);

    // Produto (múltiplos fallbacks)
    const produtoDescRaw = getPathFirst(item, [
      ["produto", "descricao"],
      ["produto", "nome"],
      ["descricao"],
      ["nome"]
    ]) as string;
    
    let produto = safeText(produtoDescRaw);
    if (!produto || produto === "-") {
      // Tentar SKU/código como fallback
      const skuRaw = getPathFirst(item, [
        ["produto", "sku"],
        ["produto", "codigo"],
        ["sku"],
        ["codigo"]
      ]) as string;
      produto = safeText(skuRaw) || `Pedido #${numeroPedido}`;
    }
    
    // ID do produto (para enrichment)
    const produtoId = getPathFirst<number>(item, [
      ["produto", "id"],
      ["id_produto"],
      ["produtoId"]
    ]);
    
    // Categoria (do enrichment - API Tiny só retorna em /produtos/{id})
    // Preferir caminhoCompleto (mais descritivo), fallback para nome
    let categoria = "N/D";
    
    if (enrichData?.produtos && produtoId) {
      const produtoEnriquecido = enrichData.produtos.get(Number(produtoId));
      if (produtoEnriquecido && typeof produtoEnriquecido === 'object' && produtoEnriquecido !== null) {
        const cat = (produtoEnriquecido as Record<string, unknown>).categoria as { 
          nome?: string;
          caminhoCompleto?: string;
        } | undefined;
        
        if (cat?.caminhoCompleto) {
          // Preferir caminho completo (ex: "Escovas -> Extra Macia -> Implante")
          categoria = cat.caminhoCompleto;
        } else if (cat?.nome) {
          // Fallback para apenas o nome
          categoria = cat.nome;
        }
      }
    }

    return {
      id: generateId(companyId, `${d.id}_${idx}`),
      company: { connect: { id: companyId } },
      dataHora,
      produto,
      categoria,
      quantidade,
      valorUnitario,
      valorTotal,
      formaPagamento,
      vendedor,
      cliente,
      cnpjCliente,
      caixa,
      status,
    };
  });
}

/**
 * [DEPRECATED] Mantido para compatibilidade
 * Use transformPedidoDetalheToVendas() ao invés
 */
export function transformPedidoToVendas(
  companyId: string,
  pedido: TinyPedidoResumo,
  itens: TinyPedidoItem[]
): VwVendasInput[] {
  const dataHora = toDate(pedido.data_pedido) ?? new Date();
  const vendedor = safeText(pedido.nome_vendedor);
  const cliente = safeText(pedido.cliente?.nome);
  const cnpjCliente = safeText(pedido.cliente?.cpf_cnpj);
  const status = safeText(pedido.situacao);

  return itens.map((item, idx) => {
    const quantidade = toPrismaDecimal(item.quantidade);
    const valorUnitario = toPrismaDecimal(item.valor_unitario);
    const valorTotal = toPrismaDecimal(item.valor_total ?? 0);

    return {
      id: generateId(companyId, `${pedido.id}_${item.id ?? idx}`),
      company: { connect: { id: companyId } },
      dataHora,
      produto: safeText(item.descricao || item.codigo, "N/D"),
      categoria: "N/D",
      quantidade,
      valorUnitario,
      valorTotal,
      formaPagamento: "N/D",
      vendedor: vendedor || "N/D",
      cliente: cliente || "N/D",
      cnpjCliente: cnpjCliente || "N/D",
      caixa: "N/D",
      status: status || "N/D",
    };
  });
}

/**
 * Transforma pedido resumido em venda única (sem itens detalhados)
 * Usado como fallback quando getPedido falha
 */
export function transformPedidoResumoToVenda(
  companyId: string,
  pedido: TinyPedidoResumo
): VwVendasInput {
  // Normalizar resumo
  const p = unwrapPedidoResumo(pedido);
  
  // Data
  const dataStr = getFirst<string>(p, ["data_pedido", "dataPedido", "data"]);
  const dataHora = toDate(dataStr) ?? new Date();
  
  // Valor
  const valorRaw = getFirst(p, ["valor", "total", "valorTotal"]);
  const valor = toPrismaDecimal(valorRaw, 0);
  
  // Número do pedido (NUNCA undefined)
  const numeroRaw = getFirst<string | number>(p, [
    "numero", "numeroPedido", "numero_pedido", "id", "pedidoId"
  ]);
  const numeroSeguro = numeroRaw !== undefined && numeroRaw !== null 
    ? String(numeroRaw) 
    : String(p.id || "0");
  
  // Cliente
  const clienteNome = getPathFirst(p, [
    ["cliente", "nome"],
    ["nome_cliente"]
  ]) as string;
  const cliente = safeText(clienteNome) || "N/D";
  
  // CPF/CNPJ
  const cpfCnpjRaw = getPathFirst(p, [
    ["cliente", "cpf_cnpj"],
    ["cliente", "cpfCnpj"],
    ["cliente", "documento"]
  ]) as string;
  const cnpjCliente = safeText(cpfCnpjRaw) || "";
  
  // Vendedor
  const vendedorRaw = getFirst<string>(p, ["nome_vendedor", "vendedor"]);
  const vendedor = safeText(vendedorRaw) || "-";
  
  // Status
  const situacaoRaw = getFirst(p, ["situacao", "status"]);
  const status = normalizeStatus(situacaoRaw);

  return {
    id: generateId(companyId, p.id as number),
    company: { connect: { id: companyId } },
    dataHora,
    produto: `Pedido #${numeroSeguro}`,
    categoria: "N/D",
    quantidade: toPrismaDecimal(1),
    valorUnitario: valor,
    valorTotal: valor,
    formaPagamento: "N/D",
    vendedor,
    cliente,
    cnpjCliente,
    caixa: "N/D",
    status,
  };
}

// ============================================
// VW_CONTAS_RECEBER_POSICAO
// ============================================

export type VwContasReceberPosicaoInput =
  Prisma.VwContasReceberPosicaoCreateInput;

/**
 * Transforma conta a receber em linha de vw_contas_receber_posicao
 */
export function transformContaReceberToPosicao(
  companyId: string,
  conta: unknown,
  dataPosicao: Date = new Date()
): VwContasReceberPosicaoInput {
  const contaObj = conta as Record<string, unknown>;
  
  // Extração segura de campos aninhados
  const clienteNome = safeGet(contaObj, ["cliente", "nome"]);
  const cliente = typeof clienteNome === 'string' && clienteNome.trim() ? clienteNome.trim() : "N/D";
  
  const cpfCnpj = safeGet(contaObj, ["cliente", "cpfCnpj"]) || safeGet(contaObj, ["cliente", "cpf_cnpj"]);
  const cnpj = typeof cpfCnpj === 'string' && cpfCnpj.trim() ? cpfCnpj.trim() : "N/D";
  
  // Categoria: API Tiny retorna objeto {id, descricao} quando existe, ou null quando não tem
  // Endpoint relacionado: /categorias-receita-despesa
  const categoriaObj = contaObj.categoria as Record<string, unknown> | null;
  let categoria = "N/D";
  if (categoriaObj && typeof categoriaObj === 'object' && categoriaObj.descricao) {
    categoria = String(categoriaObj.descricao);
  }
  
  // Centro de Custo: campo não existe na API Tiny para contas a receber
  const centroCusto = null;
  
  const valor = toPrismaDecimal(contaObj.valor, 0);
  const idConta = contaObj.id as string | number;

  return {
    id: generateId(companyId, `${idConta}_${dataPosicao.toISOString().split("T")[0]}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(idConta as number),
    cliente,
    cnpj,
    categoria,
    centroCusto,
    dataEmissao: toDate(getFirst(contaObj, ["data", "dataEmissao", "data_emissao"])) ?? new Date(),
    dataVencimento: toDate(getFirst(contaObj, ["dataVencimento", "data_vencimento"])) ?? new Date(),
    valor,
    dataPosicao,
  };
}

// ============================================
// VW_CONTAS_PAGAR
// ============================================

export type VwContasPagarInput = Prisma.VwContasPagarCreateInput;

/**
 * Transforma conta a pagar em linha de vw_contas_pagar
 */
export function transformContaPagarToView(
  companyId: string,
  conta: unknown
): VwContasPagarInput {
  const contaObj = conta as Record<string, unknown>;
  
  // IMPORTANTE: API Tiny usa "cliente" mesmo para contas a pagar (não "fornecedor")
  const fornecedorNome = safeGet(contaObj, ["cliente", "nome"]) || safeGet(contaObj, ["fornecedor", "nome"]);
  const fornecedor = typeof fornecedorNome === 'string' && fornecedorNome.trim() ? fornecedorNome.trim() : "N/D";
  
  // Categoria: Tentar extrair quando existe, senão "N/D"
  const categoriaObj = contaObj.categoria as { id?: number; descricao?: string; nome?: string } | string | undefined;
  let categoria = "N/D";
  if (typeof categoriaObj === 'object' && categoriaObj) {
    // Objeto: tentar descricao ou nome
    categoria = String(categoriaObj.descricao || categoriaObj.nome || "N/D");
  } else if (typeof categoriaObj === 'string' && categoriaObj.trim()) {
    // String simples
    categoria = categoriaObj.trim();
  }
  
  // Centro de Custo: Tentar extrair quando existe
  const centroCustoObj = contaObj.centroCusto || contaObj.centro_custo;
  let centroCusto: string | null = null;
  if (typeof centroCustoObj === 'object' && centroCustoObj) {
    const custoNome = (centroCustoObj as { nome?: string }).nome;
    if (typeof custoNome === 'string' && custoNome.trim()) {
      centroCusto = custoNome.trim();
    }
  } else if (typeof centroCustoObj === 'string' && centroCustoObj.trim()) {
    centroCusto = centroCustoObj.trim();
  }
  
  // Forma de Pagamento: Tentar extrair quando existe
  const formaPagtoObj = contaObj.formaPagamento || contaObj.forma_pagamento;
  let formaPagto: string | null = null;
  if (typeof formaPagtoObj === 'object' && formaPagtoObj) {
    const pagtoNome = (formaPagtoObj as { nome?: string }).nome;
    if (typeof pagtoNome === 'string' && pagtoNome.trim()) {
      formaPagto = pagtoNome.trim();
    }
  } else if (typeof formaPagtoObj === 'string' && formaPagtoObj.trim()) {
    formaPagto = formaPagtoObj.trim();
  }
  
  const valor = toPrismaDecimal(contaObj.valor, 0);
  const idConta = contaObj.id as string | number;

  return {
    id: generateId(companyId, idConta),
    company: { connect: { id: companyId } },
    tituloId: BigInt(idConta as number),
    fornecedor,
    categoria,
    centroCusto,
    dataEmissao: toDate(getFirst(contaObj, ["data", "dataEmissao", "data_emissao"])) ?? new Date(),
    dataVencimento: toDate(getFirst(contaObj, ["dataVencimento", "data_vencimento"])) ?? new Date(),
    valor,
    status: safeText(contaObj.situacao) || "N/D",
    formaPagto,
  };
}

// ============================================
// VW_CONTAS_PAGAS
// ============================================

export type VwContasPagasInput = Prisma.VwContasPagasCreateInput;

/**
 * Transforma conta paga em linha de vw_contas_pagas
 */
export function transformContaPagaToView(
  companyId: string,
  conta: unknown
): VwContasPagasInput | null {
  const contaObj = conta as Record<string, unknown>;
  
  // Só processa se está pago
  if (contaObj.situacao !== "pago") {
    return null;
  }

  // Data de pagamento: usar data_pagamento se disponível, senão usar data_vencimento como fallback
  const dataPagamento = toDate(getFirst(contaObj, ["data_pagamento", "dataPagamento"])) 
    ?? toDate(getFirst(contaObj, ["data_vencimento", "dataVencimento"])) 
    ?? new Date();

  // IMPORTANTE: API Tiny usa "cliente" mesmo para contas a pagar
  const fornecedorNome = safeGet(contaObj, ["cliente", "nome"]) 
    || safeGet(contaObj, ["fornecedor", "nome"]) 
    || safeGet(contaObj, ["pessoa", "nome"]);
  const fornecedor = typeof fornecedorNome === 'string' && fornecedorNome.trim() ? fornecedorNome.trim() : "N/D";
  
  // Categoria
  const categoriaObj = contaObj.categoria;
  let categoria: string | null = null;
  if (typeof categoriaObj === 'object' && categoriaObj) {
    const catNome = (categoriaObj as { nome?: string; descricao?: string }).nome 
      || (categoriaObj as { descricao?: string }).descricao;
    if (typeof catNome === 'string' && catNome.trim()) {
      categoria = catNome.trim();
    }
  } else if (typeof categoriaObj === 'string' && categoriaObj.trim()) {
    categoria = categoriaObj.trim();
  }
  
  // Centro de Custo
  const centroCustoObj = contaObj.centroCusto || contaObj.centro_custo;
  let centroCusto: string | null = null;
  if (typeof centroCustoObj === 'object' && centroCustoObj) {
    const custoNome = (centroCustoObj as { nome?: string }).nome;
    if (typeof custoNome === 'string' && custoNome.trim()) {
      centroCusto = custoNome.trim();
    }
  } else if (typeof centroCustoObj === 'string' && centroCustoObj.trim()) {
    centroCusto = centroCustoObj.trim();
  }

  const idConta = contaObj.id as string | number;

  return {
    id: generateId(companyId, `pago_${idConta}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(idConta as number),
    fornecedor,
    categoria,
    centroCusto,
    dataEmissao: toDate(getFirst(contaObj, ["data", "data_emissao", "dataEmissao"])) ?? new Date(),
    dataVencimento: toDate(getFirst(contaObj, ["data_vencimento", "dataVencimento"])) ?? new Date(),
    dataPagamento,
    valorTitulo: toPrismaDecimal(contaObj.valor, 0),
    valorPago: toPrismaDecimal(getFirst(contaObj, ["valor_pago", "valorPago", "valor"]), 0),
    desconto: toPrismaDecimal(contaObj.desconto, 0),
    juros: toPrismaDecimal(contaObj.juros, 0),
    multa: toPrismaDecimal(contaObj.multa, 0),
    contaBancaria: safeText(getFirst(contaObj, ["conta_bancaria", "contaBancaria"])),
    formaPagamento: safeText(getFirst(contaObj, ["forma_pagamento", "formaPagamento"])),
    usuarioBaixa: null,
    status: "Pago",
  };
}

// ============================================
// VW_CONTAS_RECEBIDAS
// ============================================

export type VwContasRecebidasInput = Prisma.VwContasRecebidasCreateInput;

/**
 * Transforma conta recebida em linha de vw_contas_recebidas
 */
export function transformContaRecebidaToView(
  companyId: string,
  conta: unknown
): VwContasRecebidasInput | null {
  const contaObj = conta as Record<string, unknown>;
  
  // Só processa se está pago/recebido
  if (contaObj.situacao !== "pago") {
    return null;
  }

  // Data de recebimento: usar data_pagamento se disponível, senão usar data_vencimento como fallback
  const dataRecebimento = toDate(getFirst(contaObj, ["data_pagamento", "dataPagamento"])) 
    ?? toDate(getFirst(contaObj, ["data_vencimento", "dataVencimento"])) 
    ?? new Date();

  const idConta = contaObj.id as string | number;

  return {
    id: generateId(companyId, `recebido_${idConta}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(idConta as number),
    cliente: safeText(safeGet(contaObj, ["cliente", "nome"]) || safeGet(contaObj, ["pessoa", "nome"])),
    cnpjCpf: safeText(safeGet(contaObj, ["cliente", "cpfCnpj"]) || safeGet(contaObj, ["pessoa", "cpfCnpj"])),
    categoria: safeText(safeGet(contaObj, ["categoria", "nome"]) || safeGet(contaObj, "categoria")),
    centroCusto: safeText(safeGet(contaObj, ["centroCusto", "nome"]) || safeGet(contaObj, "centroCusto")),
    dataEmissao: toDate(getFirst(contaObj, ["data_emissao", "dataEmissao"])) ?? new Date(),
    dataVencimento: toDate(getFirst(contaObj, ["data_vencimento", "dataVencimento"])) ?? new Date(),
    dataRecebimento,
    valorTitulo: toPrismaDecimal(contaObj.valor, 0),
    valorRecebido: toPrismaDecimal(getFirst(contaObj, ["valor_recebido", "valorRecebido", "valor"]), 0),
    desconto: toPrismaDecimal(contaObj.desconto, 0),
    juros: toPrismaDecimal(contaObj.juros, 0),
    multa: toPrismaDecimal(contaObj.multa, 0),
    comissaoCartao: toPrismaDecimal(getFirst(contaObj, ["comissao_cartao", "comissaoCartao"]) ?? 0, 0),
    comissaoMktplaces: toPrismaDecimal(getFirst(contaObj, ["comissao_marketplaces", "comissaoMarketplaces"]) ?? 0, 0),
    contaBancaria: safeText(getFirst(contaObj, ["conta_bancaria", "contaBancaria"])),
    formaRecebimento: safeText(getFirst(contaObj, ["forma_pagamento", "formaPagamento"])),
    usuarioBaixa: null,
    status: "Recebido",
  };
}

// ============================================
// VW_ESTOQUE (Snapshot de Estoque)
// ============================================

export type VwEstoqueInput = Prisma.VwEstoqueCreateInput;

/**
 * Transforma produto em linha de vw_estoque (snapshot diário)
 * Schema: Data_Referencia, Produto, Categoria, Unidade_Medida, Estoque_Inicial, Entradas, Saidas, Ajustes, Estoque_Final, etc.
 */
export function transformProdutoToEstoque(
  companyId: string,
  produto: Record<string, unknown>,
  dataReferencia: Date
): Prisma.VwEstoqueCreateInput {
  const produtoNome = safeText(pickFirst(produto.descricao, produto.nome, `Produto ${produto.id}`));
  const categoriaNome = safeText(safeGet(produto, ["categoria", "nome"]));
  const unidade = safeText(produto.unidade || "UN");
  const saldoFinalStr = toDecimal(produto.saldo ?? produto.saldoFisico ?? 0) ?? "0";
  const custoMedioStr = toDecimal(produto.custoMedio ?? produto.preco ?? 0) ?? "0";
  
  const saldoFinal = parseFloat(saldoFinalStr);
  const custoMedio = parseFloat(custoMedioStr);
  
  return {
    id: generateId(companyId, `estoque_${produto.id}_${dataReferencia.toISOString().split("T")[0]}`),
    company: { connect: { id: companyId } },
    dataReferencia,
    produto: produtoNome,
    categoria: categoriaNome,
    unidadeMedida: unidade,
    // Snapshot: Não temos dados de movimentação (inicial/entradas/saidas/ajustes) via GET /produtos
    // Documentar que esses campos são "0" até implementar endpoint de movimentações
    estoqueInicial: toPrismaDecimal(0),
    entradas: toPrismaDecimal(0),
    saidas: toPrismaDecimal(0),
    ajustes: toPrismaDecimal(0),
    estoqueFinal: toPrismaDecimal(saldoFinal),
    custoMedio: toPrismaDecimal(custoMedio, 4), // 4 casas decimais
    valorTotalEstoque: toPrismaDecimal(saldoFinal * custoMedio),
    fornecedorUltimaCompra: "-", // Não disponível via GET /produtos
    dataUltimaCompra: new Date("2000-01-01"), // Data placeholder (campo obrigatório)
    responsavelConferencia: "-", // Não disponível
    observacao: "-", // Não disponível
  };
}

