/**
 * Transformers: Tiny API → Tabelas vw_*
 * Mapeamento de campos e derivação de valores ausentes
 */

import { Prisma } from "@prisma/client";
import {
  TinyPedidoResumo,
  TinyPedidoItem,
  TinyContaReceber,
  TinyContaPagar,
} from "./types";

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Converte string de data Tiny (DD/MM/YYYY ou YYYY-MM-DD) para Date
 */
const parseDate = (dateStr: string | undefined): Date => {
  if (!dateStr) return new Date();

  // Se já está no formato ISO
  if (dateStr.includes("-") && dateStr.length >= 10) {
    return new Date(dateStr);
  }

  // Formato DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return new Date(dateStr);
};

/**
 * Valor padrão para campos ausentes
 */
const ND = "N/D";

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
 * Transforma um pedido + seus itens em múltiplas linhas de vw_vendas
 * (uma linha por item do pedido)
 */
export function transformPedidoToVendas(
  companyId: string,
  pedido: TinyPedidoResumo,
  itens: TinyPedidoItem[]
): VwVendasInput[] {
  const dataHora = parseDate(pedido.data_pedido);
  const vendedor = pedido.nome_vendedor ?? ND;
  const cliente = pedido.cliente?.nome ?? ND;
  const cnpjCliente = pedido.cliente?.cpf_cnpj ?? ND;
  const status = pedido.situacao ?? ND;

  return itens.map((item, idx) => ({
    id: generateId(companyId, `${pedido.id}_${item.id ?? idx}`),
    company: { connect: { id: companyId } },
    dataHora,
    produto: item.descricao || item.codigo || ND,
    categoria: ND, // Tiny não retorna categoria no item; derivar se necessário
    quantidade: new Prisma.Decimal(item.quantidade || 0),
    valorUnitario: new Prisma.Decimal(item.valor_unitario || 0),
    valorTotal: new Prisma.Decimal(
      item.valor_total ?? item.quantidade * item.valor_unitario
    ),
    formaPagamento: ND, // Obtido do pedido detalhe se necessário
    vendedor,
    cliente,
    cnpjCliente,
    caixa: ND, // Tiny não tem conceito de caixa; usar N/D
    status,
  }));
}

/**
 * Transforma pedido resumido em venda única (sem itens detalhados)
 */
export function transformPedidoResumoToVenda(
  companyId: string,
  pedido: TinyPedidoResumo
): VwVendasInput {
  const dataHora = parseDate(pedido.data_pedido);

  return {
    id: generateId(companyId, pedido.id),
    company: { connect: { id: companyId } },
    dataHora,
    produto: `Pedido #${pedido.numero}`,
    categoria: ND,
    quantidade: new Prisma.Decimal(1),
    valorUnitario: new Prisma.Decimal(pedido.valor || 0),
    valorTotal: new Prisma.Decimal(pedido.valor || 0),
    formaPagamento: ND,
    vendedor: pedido.nome_vendedor ?? ND,
    cliente: pedido.cliente?.nome ?? ND,
    cnpjCliente: pedido.cliente?.cpf_cnpj ?? ND,
    caixa: ND,
    status: pedido.situacao ?? ND,
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
  conta: TinyContaReceber,
  dataPosicao: Date = new Date()
): VwContasReceberPosicaoInput {
  return {
    id: generateId(companyId, `${conta.id}_${dataPosicao.toISOString().split("T")[0]}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    cliente: conta.cliente?.nome ?? ND,
    cnpj: conta.cliente?.cpf_cnpj ?? ND,
    categoria: conta.categoria ?? ND,
    centroCusto: conta.centro_custo,
    dataEmissao: parseDate(conta.data_emissao),
    dataVencimento: parseDate(conta.data_vencimento),
    valor: new Prisma.Decimal(conta.valor || 0),
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
  conta: TinyContaPagar
): VwContasPagarInput {
  return {
    id: generateId(companyId, conta.id),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    fornecedor: conta.fornecedor?.nome ?? ND,
    categoria: conta.categoria ?? ND,
    centroCusto: conta.centro_custo,
    dataEmissao: parseDate(conta.data_emissao),
    dataVencimento: parseDate(conta.data_vencimento),
    valor: new Prisma.Decimal(conta.valor || 0),
    status: conta.situacao ?? ND,
    formaPagto: conta.forma_pagamento,
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
  conta: TinyContaPagar
): VwContasPagasInput | null {
  // Só processa se está pago e tem data de pagamento
  if (conta.situacao !== "pago" || !conta.data_pagamento) {
    return null;
  }

  return {
    id: generateId(companyId, `pago_${conta.id}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    fornecedor: conta.fornecedor?.nome ?? ND,
    categoria: conta.categoria ?? ND,
    centroCusto: conta.centro_custo,
    dataEmissao: parseDate(conta.data_emissao),
    dataVencimento: parseDate(conta.data_vencimento),
    dataPagamento: parseDate(conta.data_pagamento),
    valorTitulo: new Prisma.Decimal(conta.valor || 0),
    valorPago: new Prisma.Decimal(conta.valor_pago ?? conta.valor ?? 0),
    desconto: new Prisma.Decimal(conta.desconto ?? 0),
    juros: new Prisma.Decimal(conta.juros ?? 0),
    multa: new Prisma.Decimal(conta.multa ?? 0),
    contaBancaria: conta.conta_bancaria ?? ND,
    formaPagamento: conta.forma_pagamento ?? ND,
    usuarioBaixa: null, // Tiny não fornece essa info
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
  conta: TinyContaReceber
): VwContasRecebidasInput | null {
  // Só processa se está pago/recebido e tem data de pagamento
  if (conta.situacao !== "pago" || !conta.data_pagamento) {
    return null;
  }

  return {
    id: generateId(companyId, `recebido_${conta.id}`),
    company: { connect: { id: companyId } },
    tituloId: BigInt(conta.id),
    cliente: conta.cliente?.nome ?? ND,
    cnpjCpf: conta.cliente?.cpf_cnpj ?? ND,
    categoria: conta.categoria ?? ND,
    centroCusto: conta.centro_custo,
    dataEmissao: parseDate(conta.data_emissao),
    dataVencimento: parseDate(conta.data_vencimento),
    dataRecebimento: parseDate(conta.data_pagamento),
    valorTitulo: new Prisma.Decimal(conta.valor || 0),
    valorRecebido: new Prisma.Decimal(conta.valor_recebido ?? conta.valor ?? 0),
    desconto: new Prisma.Decimal(conta.desconto ?? 0),
    juros: new Prisma.Decimal(conta.juros ?? 0),
    multa: new Prisma.Decimal(conta.multa ?? 0),
    comissaoCartao: new Prisma.Decimal(0), // Tiny não fornece
    comissaoMktplaces: new Prisma.Decimal(0), // Tiny não fornece
    contaBancaria: conta.conta_bancaria ?? ND,
    formaRecebimento: conta.forma_pagamento ?? ND,
    usuarioBaixa: null, // Tiny não fornece
    status: "Recebido",
  };
}

