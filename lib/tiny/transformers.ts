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
import { debugMapping, debugWarn } from "@/lib/debug";
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

// ============================================
// VW_VENDAS (de Pedidos)
// ============================================

export type VwVendasInput = Prisma.VwVendasCreateInput;

/**
 * Mapeia código de situação para texto legível (baseado em docs Tiny V3)
 */
const mapSituacao = (codigo?: number | string): string => {
  if (codigo === undefined || codigo === null) {
    return "Desconhecido";
  }
  
  const map: Record<string, string> = {
    "0": "Em aberto",
    "1": "Aprovado",
    "2": "Cancelado",
    "3": "Atendido",
    "4": "Preparando envio",
    "5": "Faturado",
    "6": "Pronto para envio",
  };
  return map[String(codigo)] ?? `SITUACAO_${codigo}`;
};

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
  // Extração segura de campos aninhados com fallback camel/snake
  const dataStr = getFirst<string>(detalhe, ["dataPedido", "data_pedido", "data"]);
  const dataHora = toDate(dataStr) ?? new Date();
  
  const cliente = safeText(
    getPathFirst(detalhe, [["cliente", "nome"]]) as string,
    "Cliente não identificado"
  );
  const cnpjCliente = safeText(
    getPathFirst(detalhe, [["cliente", "cpfCnpj"], ["cliente", "cpf_cnpj"]]) as string
  );
  const vendedor = safeText(
    getPathFirst(detalhe, [["vendedor", "nome"]]) as string
  );
  
  // Forma de pagamento completa (forma + meio)
  const formaPagto = safeText(safeGet(detalhe, ["pagamento", "formaPagamento", "nome"]));
  const meioPagto = safeText(safeGet(detalhe, ["pagamento", "meioPagamento", "nome"]));
  const formaPagamento = pickFirst(
    meioPagto ? `${formaPagto} (${meioPagto})` : formaPagto,
    formaPagto,
    ""
  ) || "N/D";

  // "Caixa" = origem da venda (marketplace, meio pagamento, depósito)
  const caixa = pickFirst(
    safeGet(detalhe, ["ecommerce", "nome"]),
    safeGet(detalhe, ["pagamento", "meioPagamento", "nome"]),
    safeGet(detalhe, ["deposito", "nome"]),
    ""
  ) || "N/D";

  const situacaoRaw = getFirst<string | number>(detalhe, ["situacao", "situacaoCodigo"]);
  const status = mapSituacao(situacaoRaw);
  const itens = getFirst<TinyPedidoItem[]>(detalhe, ["itens"]) ?? [];
  
  if (itens.length === 0) {
    // Pedido sem itens: criar linha única com valor total
    debugWarn("vw_vendas", "itens", itens, "detalhe.itens");
    
    const numeroPedido = getFirst(detalhe, ["numeroPedido", "numero_pedido", "numero"]);
    const valorTotal = getFirst(detalhe, ["valorTotalPedido", "valor_total_pedido", "total", "valor"]);
    
    return [
      {
        id: generateId(companyId, detalhe.id),
        company: { connect: { id: companyId } },
        dataHora,
        produto: `Pedido #${numeroPedido ?? detalhe.id}`,
        categoria: "N/D",
        quantidade: toPrismaDecimal(1),
        valorUnitario: toPrismaDecimal(valorTotal),
        valorTotal: toPrismaDecimal(valorTotal),
        formaPagamento,
        vendedor,
        cliente,
        cnpjCliente,
        caixa,
        status,
      },
    ];
  }

  return itens.map((item: TinyPedidoItem, idx: number) => {
    // Suporte para snake_case e camelCase usando helpers
    const qtdRaw = getFirst(item, ["quantidade", "qtd"]);
    const vlrUnitRaw = getFirst(item, ["valorUnitario", "valor_unitario"]);
    
    const quantidade = toPrismaDecimal(qtdRaw, 0);
    const valorUnitario = toPrismaDecimal(vlrUnitRaw, 0);
    
    // Calcular valor total do item (quantidade × valorUnitario)
    const qtdNum = parseFloat(toDecimal(qtdRaw) ?? "0");
    const vlrNum = parseFloat(toDecimal(vlrUnitRaw) ?? "0");
    const valorTotal = toPrismaDecimal(qtdNum * vlrNum, 0);

    const produto = safeText(
      getPathFirst(item, [["produto", "descricao"], ["descricao"]]) as string,
      "Produto não identificado"
    );
    const produtoId = getPathFirst<number>(item, [["produto", "id"]]);
    
    // Tentar buscar categoria do enrichment (se fornecido)
    let categoria = "-";
    if (enrichData?.produtos && produtoId) {
      const produtoEnriquecido = enrichData.produtos.get(Number(produtoId));
      
      // Type guard para extrair categoria
      if (produtoEnriquecido && typeof produtoEnriquecido === 'object') {
        const prod = produtoEnriquecido as Record<string, unknown>;
        const cat = prod.categoria as Record<string, unknown> | undefined;
        if (cat?.nome) {
          categoria = String(cat.nome);
        }
      }
    }

    // Debug para primeiro item
    if (idx === 0) {debugMapping("vw_vendas", item, {
        produto,
        categoria,
        quantidade: quantidade.toString(),
        valorUnitario: valorUnitario.toString(),
        valorTotal: valorTotal.toString(),
      }, idx);
    }

    return {
      id: generateId(companyId, `${detalhe.id}_${idx}`),
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
 */
export function transformPedidoResumoToVenda(
  companyId: string,
  pedido: TinyPedidoResumo
): VwVendasInput {
  const dataHora = toDate(pedido.data_pedido) ?? new Date();
  const valor = toPrismaDecimal(pedido.valor, 0);

  return {
    id: generateId(companyId, pedido.id),
    company: { connect: { id: companyId } },
    dataHora,
    produto: `Pedido #${pedido.numero}`,
    categoria: "N/D",
    quantidade: toPrismaDecimal(1),
    valorUnitario: valor,
    valorTotal: valor,
    formaPagamento: "N/D",
    vendedor: safeText(pedido.nome_vendedor) || "N/D",
    cliente: safeText(pedido.cliente?.nome) || "N/D",
    cnpjCliente: safeText(pedido.cliente?.cpf_cnpj) || "N/D",
    caixa: "N/D",
    status: safeText(pedido.situacao) || "N/D",
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
  const cliente = safeText(safeGet(contaObj, ["cliente", "nome"]));
  const cnpj = safeText(safeGet(contaObj, ["cliente", "cpfCnpj"]));
  const categoria = safeText(safeGet(contaObj, ["categoria", "nome"]) || safeGet(contaObj, "categoria"));
  const centroCusto = safeText(safeGet(contaObj, ["centroCusto", "nome"]) || safeGet(contaObj, "centroCusto"));
  
  const valor = toPrismaDecimal(contaObj.valor, 0);
  const idConta = contaObj.id as string | number;

  return {
    id: generateId(companyId, `${idConta}_${dataPosicao.toISOString().split("T")[0]}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(idConta as number),
    cliente: cliente || "N/D",
    cnpj: cnpj || "N/D",
    categoria: categoria || "N/D",
    centroCusto: centroCusto || null,
    dataEmissao: toDate(getFirst(contaObj, ["dataEmissao", "data_emissao"])) ?? new Date(),
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
  
  // Extração segura de campos aninhados
  const fornecedor = safeText(safeGet(contaObj, ["fornecedor", "nome"]));
  const categoria = safeText(safeGet(contaObj, ["categoria", "nome"]) || safeGet(contaObj, "categoria"));
  const centroCusto = safeText(safeGet(contaObj, ["centroCusto", "nome"]) || safeGet(contaObj, "centroCusto"));
  const formaPagto = safeText(safeGet(contaObj, ["formaPagamento", "nome"]) || safeGet(contaObj, "forma_pagamento"));
  
  const valor = toPrismaDecimal(contaObj.valor, 0);
  const idConta = contaObj.id as string | number;

  return {
    id: generateId(companyId, idConta),
    company: { connect: { id: companyId } },
    tituloId: BigInt(idConta as number),
    fornecedor: fornecedor || "N/D",
    categoria: categoria || "N/D",
    centroCusto: centroCusto || null,
    dataEmissao: toDate(getFirst(contaObj, ["dataEmissao", "data_emissao"])) ?? new Date(),
    dataVencimento: toDate(getFirst(contaObj, ["dataVencimento", "data_vencimento"])) ?? new Date(),
    valor,
    status: safeText(contaObj.situacao) || "N/D",
    formaPagto: formaPagto || null,
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

  const idConta = contaObj.id as string | number;

  return {
    id: generateId(companyId, `pago_${idConta}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(idConta as number),
    fornecedor: safeText(safeGet(contaObj, ["fornecedor", "nome"]) || safeGet(contaObj, ["pessoa", "nome"])),
    categoria: safeText(safeGet(contaObj, ["categoria", "nome"]) || safeGet(contaObj, "categoria")),
    centroCusto: safeText(safeGet(contaObj, ["centroCusto", "nome"]) || safeGet(contaObj, "centroCusto")),
    dataEmissao: toDate(getFirst(contaObj, ["data_emissao", "dataEmissao"])) ?? new Date(),
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

