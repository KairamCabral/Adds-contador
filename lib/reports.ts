import { prisma } from "@/lib/db";
import {
  Prisma,
  VwContasPagar,
  VwContasPagas,
  VwContasReceberPosicao,
  VwContasRecebidas,
  VwEstoque,
  VwVendas,
} from "@prisma/client";

import { ReportConfig, ReportView, reports } from "@/app/relatorios/config";

type ReportFilters = {
  companyId: string;
  start?: string;
  end?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

type ReportResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const buildWhere = (
  config: ReportConfig,
  filters: ReportFilters,
): Record<string, unknown> => {
  const where: Record<string, unknown> = {
    companyId: filters.companyId,
  };

  if (filters.start || filters.end) {
    const dateFilter: Record<string, Date> = {};
    
    if (filters.start) {
      // Data inicial: início do dia (00:00:00) no horário local
      const startDate = new Date(filters.start + 'T00:00:00-03:00');
      dateFilter.gte = startDate;
    }
    
    if (filters.end) {
      // Data final: final do dia (23:59:59.999) no horário local
      const endDate = new Date(filters.end + 'T23:59:59.999-03:00');
      dateFilter.lte = endDate;
    }
    
    where[config.dateField] = dateFilter;
  }

  if (filters.status && config.statusField) {
    where[config.statusField] = {
      contains: filters.status,
      mode: "insensitive",
    };
  }

  if (filters.search && config.searchFields.length > 0) {
    where.OR = config.searchFields.map((field) => ({
      [field]: {
        contains: filters.search,
        mode: "insensitive",
      },
    }));
  }

  return where;
};

const paginate = (page?: number, pageSize = 20) => {
  const safePage = Math.max(1, page ?? 1);
  const take = pageSize;
  const skip = (safePage - 1) * take;
  return { take, skip, page: safePage, pageSize: take };
};

// Cursor-based pagination para grandes datasets (mais performático que offset)
export async function fetchReportCursor<T>(
  view: ReportView,
  filters: ReportFilters & { cursor?: string }
): Promise<{ items: T[]; nextCursor?: string; total: number }> {
  const config = reports[view];
  const pageSize = filters.pageSize || 20;
  const where = buildWhere(config, filters);
  
  const modelName = view.replace('vw_', 'vw');
  const model = (prisma as any)[modelName];
  
  if (!model) {
    throw new Error(`Model ${modelName} not found`);
  }
  
  const [items, total] = await Promise.all([
    model.findMany({
      where,
      take: pageSize + 1, // +1 para verificar se há próxima página
      ...(filters.cursor && {
        cursor: { id: filters.cursor },
        skip: 1, // Pular o cursor
      }),
      orderBy: { id: 'desc' },
    }),
    model.count({ where }),
  ]);
  
  let nextCursor: string | undefined;
  if (items.length > pageSize) {
    const nextItem = items.pop();
    nextCursor = nextItem?.id;
  }
  
  return { items, nextCursor, total };
}

async function fetchVendas(
  filters: ReportFilters,
  config: ReportConfig,
): Promise<ReportResult<VwVendas>> {
  const where = buildWhere(config, filters) as Prisma.VwVendasWhereInput;
  
  // Excluir pedidos "Em aberto" (conforme solicitação do usuário)
  where.status = {
    not: "Em aberto",
  };
  
  const { take, skip, page, pageSize } = paginate(filters.page, filters.pageSize);

  const [items, total] = await Promise.all([
    prisma.vwVendas.findMany({
      where,
      orderBy: { dataHora: "desc" },
      take,
      skip,
    }),
    prisma.vwVendas.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

async function fetchContasReceberPosicao(
  filters: ReportFilters,
  config: ReportConfig,
): Promise<ReportResult<VwContasReceberPosicao>> {
  const where = buildWhere(
    config,
    filters,
  ) as Prisma.VwContasReceberPosicaoWhereInput;
  const { take, skip, page, pageSize } = paginate(filters.page, filters.pageSize);

  const [items, total] = await Promise.all([
    prisma.vwContasReceberPosicao.findMany({
      where,
      orderBy: { dataPosicao: "desc" },
      take,
      skip,
    }),
    prisma.vwContasReceberPosicao.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

async function fetchContasPagar(
  filters: ReportFilters,
  config: ReportConfig,
): Promise<ReportResult<VwContasPagar>> {
  const where = buildWhere(config, filters) as Prisma.VwContasPagarWhereInput;
  const { take, skip, page, pageSize } = paginate(filters.page, filters.pageSize);

  const [items, total] = await Promise.all([
    prisma.vwContasPagar.findMany({
      where,
      orderBy: { dataVencimento: "desc" },
      take,
      skip,
    }),
    prisma.vwContasPagar.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

async function fetchContasPagas(
  filters: ReportFilters,
  config: ReportConfig,
): Promise<ReportResult<VwContasPagas>> {
  const where = buildWhere(config, filters) as Prisma.VwContasPagasWhereInput;
  const { take, skip, page, pageSize } = paginate(filters.page, filters.pageSize);

  const [items, total] = await Promise.all([
    prisma.vwContasPagas.findMany({
      where,
      orderBy: { dataPagamento: "desc" },
      take,
      skip,
    }),
    prisma.vwContasPagas.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

async function fetchEstoque(
  filters: ReportFilters,
  config: ReportConfig,
): Promise<ReportResult<VwEstoque>> {
  const where = buildWhere(config, filters) as Prisma.VwEstoqueWhereInput;
  const { take, skip, page, pageSize } = paginate(filters.page, filters.pageSize);

  const [items, total] = await Promise.all([
    prisma.vwEstoque.findMany({
      where,
      orderBy: { dataReferencia: "desc" },
      take,
      skip,
    }),
    prisma.vwEstoque.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

async function fetchContasRecebidas(
  filters: ReportFilters,
  config: ReportConfig,
): Promise<ReportResult<VwContasRecebidas>> {
  const where = buildWhere(config, filters) as Prisma.VwContasRecebidasWhereInput;
  const { take, skip, page, pageSize } = paginate(filters.page, filters.pageSize);

  const [items, total] = await Promise.all([
    prisma.vwContasRecebidas.findMany({
      where,
      orderBy: { dataRecebimento: "desc" },
      take,
      skip,
    }),
    prisma.vwContasRecebidas.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function fetchReport(
  view: ReportView,
  filters: ReportFilters,
): Promise<ReportResult<unknown>> {
  const config = reports[view];
  switch (view) {
    case "vw_vendas":
      return fetchVendas(filters, config);
    case "vw_contas_receber_posicao":
      return fetchContasReceberPosicao(filters, config);
    case "vw_contas_pagar":
      return fetchContasPagar(filters, config);
    case "vw_contas_pagas":
      return fetchContasPagas(filters, config);
    case "vw_estoque":
      return fetchEstoque(filters, config);
    case "vw_contas_recebidas":
      return fetchContasRecebidas(filters, config);
    default:
      throw new Error("View não suportada");
  }
}

export type { ReportFilters, ReportResult };

