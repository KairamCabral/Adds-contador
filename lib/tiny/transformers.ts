/**
 * Transformers: Tiny API → Tabelas vw_*
 * Mapeamento de campos e derivação de valores ausentes
 */

import { Prisma } from "@prisma/client";
import {
  TinyPedidoResumo,
  TinyPedidoItem,
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
const mapSituacao = (codigo: number | string): string => {
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
  detalhe: unknown,
  enrichData?: { produtos?: Map<number, unknown> }
): VwVendasInput[] {
  // Extração segura de campos aninhados
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/tiny/transformers.ts:transformPedidoDetalheToVendas',message:'Debug datas disponíveis',data:{pedidoId:detalhe.id,detalheData:detalhe.data,detalheDataPedido:detalhe.dataPedido,detalheDataPrevisao:detalhe.dataPrevisao,allDateKeys:Object.keys(detalhe).filter(k=>k.toLowerCase().includes('data'))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3_DATA'})}).catch(()=>{});
  // #endregion
  
  const dataHora = toDate(detalhe.dataPedido ?? detalhe.data) ?? new Date();
  const cliente = safeText(safeGet(detalhe, ["cliente", "nome"]), "Cliente não identificado");
  const cnpjCliente = safeText(safeGet(detalhe, ["cliente", "cpfCnpj"]));
  const vendedor = safeText(safeGet(detalhe, ["vendedor", "nome"]));
  
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

  const status = mapSituacao(detalhe.situacao);
  const itens = detalhe.itens || [];

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/tiny/transformers.ts:transformPedidoDetalheToVendas',message:'Transformando pedido',data:{pedidoId:detalhe.id,itensCount:itens.length,cliente,cnpjCliente,formaPagamento,caixa,status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  if (itens.length === 0) {
    // Pedido sem itens: criar linha única com valor total
    debugWarn("vw_vendas", "itens", itens, "detalhe.itens");
    
    return [
      {
        id: generateId(companyId, detalhe.id),
        company: { connect: { id: companyId } },
        dataHora,
        produto: `Pedido #${detalhe.numeroPedido}`,
        categoria: "N/D",
        quantidade: toPrismaDecimal(1),
        valorUnitario: toPrismaDecimal(detalhe.valorTotalPedido),
        valorTotal: toPrismaDecimal(detalhe.valorTotalPedido),
        formaPagamento,
        vendedor,
        cliente,
        cnpjCliente,
        caixa,
        status,
      },
    ];
  }

  return itens.map((item: unknown, idx: number) => {
    const quantidade = toPrismaDecimal(item.quantidade, 0);
    const valorUnitario = toPrismaDecimal(item.valorUnitario, 0);
    
    // Calcular valor total do item (quantidade × valorUnitario)
    const qtdNum = parseFloat(toDecimal(item.quantidade) ?? "0");
    const vlrNum = parseFloat(toDecimal(item.valorUnitario) ?? "0");
    const valorTotal = toPrismaDecimal(qtdNum * vlrNum, 0);

    const produto = safeText(safeGet(item, ["produto", "descricao"]), "Produto não identificado");
    const produtoId = item?.produto?.id;
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/tiny/transformers.ts:transformPedidoDetalheToVendas',message:'Debug categoria',data:{pedidoId:detalhe.id,itemIdx:idx,produtoId,produtoIdType:typeof produtoId,hasEnrichData:!!enrichData?.produtos,enrichDataSize:enrichData?.produtos?.size},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1_CATEGORIA'})}).catch(()=>{});
    // #endregion
    
    // Tentar buscar categoria do enrichment (se fornecido)
    let categoria = "-";
    if (enrichData?.produtos && produtoId) {
      const produtoEnriquecido = enrichData.produtos.get(Number(produtoId));
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/tiny/transformers.ts:transformPedidoDetalheToVendas',message:'Produto enriquecido',data:{produtoId,found:!!produtoEnriquecido,categoria:produtoEnriquecido?.categoria},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2_CATEGORIA'})}).catch(()=>{});
      // #endregion
      
      if (produtoEnriquecido?.categoria?.nome) {
        categoria = produtoEnriquecido.categoria.nome;
      }
    }

    // Debug para primeiro item
    if (idx === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/65d1d0bb-d98f-4763-a66c-cbc2a12cadad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/tiny/transformers.ts:transformPedidoDetalheToVendas',message:'Item transformado',data:{pedidoId:detalhe.id,itemIdx:idx,produto,categoria,quantidade:quantidade.toString(),valorUnitario:valorUnitario.toString(),valorTotal:valorTotal.toString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1_ENRICH'})}).catch(()=>{});
      // #endregion
      
      debugMapping("vw_vendas", item, {
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
  // Extração segura de campos aninhados
  const cliente = safeText(safeGet(conta, ["cliente", "nome"]));
  const cnpj = safeText(safeGet(conta, ["cliente", "cpfCnpj"]));
  const categoria = safeText(safeGet(conta, ["categoria", "nome"]) || safeGet(conta, "categoria"));
  const centroCusto = safeText(safeGet(conta, ["centroCusto", "nome"]) || safeGet(conta, "centroCusto"));
  
  const valor = toPrismaDecimal(conta.valor, 0);

  return {
    id: generateId(companyId, `${conta.id}_${dataPosicao.toISOString().split("T")[0]}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    cliente: cliente || "N/D",
    cnpj: cnpj || "N/D",
    categoria: categoria || "N/D",
    centroCusto: centroCusto || null,
    dataEmissao: toDate(conta.dataEmissao || conta.data_emissao) ?? new Date(),
    dataVencimento: toDate(conta.dataVencimento || conta.data_vencimento) ?? new Date(),
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
  // Extração segura de campos aninhados
  const fornecedor = safeText(safeGet(conta, ["fornecedor", "nome"]));
  const categoria = safeText(safeGet(conta, ["categoria", "nome"]) || safeGet(conta, "categoria"));
  const centroCusto = safeText(safeGet(conta, ["centroCusto", "nome"]) || safeGet(conta, "centroCusto"));
  const formaPagto = safeText(safeGet(conta, ["formaPagamento", "nome"]) || safeGet(conta, "forma_pagamento"));
  
  const valor = toPrismaDecimal(conta.valor, 0);

  return {
    id: generateId(companyId, conta.id),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    fornecedor: fornecedor || "N/D",
    categoria: categoria || "N/D",
    centroCusto: centroCusto || null,
    dataEmissao: toDate(conta.dataEmissao || conta.data_emissao) ?? new Date(),
    dataVencimento: toDate(conta.dataVencimento || conta.data_vencimento) ?? new Date(),
    valor,
    status: safeText(conta.situacao) || "N/D",
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
  // Só processa se está pago
  if (conta.situacao !== "pago") {
    return null;
  }

  // Data de pagamento: usar data_pagamento se disponível, senão usar data_vencimento como fallback
  const dataPagamento = toDate(conta.data_pagamento ?? conta.dataPagamento) ?? toDate(conta.data_vencimento) ?? new Date();

  return {
    id: generateId(companyId, `pago_${conta.id}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    fornecedor: safeText(safeGet(conta, ["fornecedor", "nome"]) || safeGet(conta, ["pessoa", "nome"])),
    categoria: safeText(safeGet(conta, ["categoria", "nome"]) || safeGet(conta, "categoria")),
    centroCusto: safeText(safeGet(conta, ["centroCusto", "nome"]) || safeGet(conta, "centroCusto")),
    dataEmissao: toDate(conta.data_emissao ?? conta.dataEmissao) ?? new Date(),
    dataVencimento: toDate(conta.data_vencimento ?? conta.dataVencimento) ?? new Date(),
    dataPagamento,
    valorTitulo: toPrismaDecimal(conta.valor, 0),
    valorPago: toPrismaDecimal(conta.valor_pago ?? conta.valorPago ?? conta.valor, 0),
    desconto: toPrismaDecimal(conta.desconto, 0),
    juros: toPrismaDecimal(conta.juros, 0),
    multa: toPrismaDecimal(conta.multa, 0),
    contaBancaria: safeText(conta.conta_bancaria ?? conta.contaBancaria),
    formaPagamento: safeText(conta.forma_pagamento ?? conta.formaPagamento),
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
  // Só processa se está pago/recebido
  if (conta.situacao !== "pago") {
    return null;
  }

  // Data de recebimento: usar data_pagamento se disponível, senão usar data_vencimento como fallback
  const dataRecebimento = toDate(conta.data_pagamento ?? conta.dataPagamento) ?? toDate(conta.data_vencimento) ?? new Date();

  return {
    id: generateId(companyId, `recebido_${conta.id}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    cliente: safeText(safeGet(conta, ["cliente", "nome"]) || safeGet(conta, ["pessoa", "nome"])),
    cnpjCpf: safeText(safeGet(conta, ["cliente", "cpfCnpj"]) || safeGet(conta, ["pessoa", "cpfCnpj"])),
    categoria: safeText(safeGet(conta, ["categoria", "nome"]) || safeGet(conta, "categoria")),
    centroCusto: safeText(safeGet(conta, ["centroCusto", "nome"]) || safeGet(conta, "centroCusto")),
    dataEmissao: toDate(conta.data_emissao ?? conta.dataEmissao) ?? new Date(),
    dataVencimento: toDate(conta.data_vencimento ?? conta.dataVencimento) ?? new Date(),
    dataRecebimento,
    valorTitulo: toPrismaDecimal(conta.valor, 0),
    valorRecebido: toPrismaDecimal(conta.valor_recebido ?? conta.valorRecebido ?? conta.valor, 0),
    desconto: toPrismaDecimal(conta.desconto, 0),
    juros: toPrismaDecimal(conta.juros, 0),
    multa: toPrismaDecimal(conta.multa, 0),
    comissaoCartao: toPrismaDecimal(conta.comissao_cartao ?? conta.comissaoCartao ?? 0, 0),
    comissaoMktplaces: toPrismaDecimal(conta.comissao_marketplaces ?? conta.comissaoMarketplaces ?? 0, 0),
    contaBancaria: safeText(conta.conta_bancaria ?? conta.contaBancaria),
    formaRecebimento: safeText(conta.forma_pagamento ?? conta.formaPagamento),
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
  produto: any,
  dataReferencia: Date
): Prisma.vwEstoqueCreateInput {
  const produtoNome = safeText(pickFirst(produto.descricao, produto.nome, `Produto ${produto.id}`));
  const categoriaNome = safeText(safeGet(produto, ["categoria", "nome"]));
  const unidade = safeText(produto.unidade || "UN");
  const saldoFinal = toDecimal(produto.saldo ?? produto.saldoFisico ?? 0) ?? 0;
  const custoMedio = toDecimal(produto.custoMedio ?? produto.preco ?? 0) ?? 0;
  
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

