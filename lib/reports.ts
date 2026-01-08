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
    where[config.dateField] = {
      ...(filters.start ? { gte: new Date(filters.start) } : {}),
      ...(filters.end ? { lte: new Date(filters.end) } : {}),
    };
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

async function fetchVendas(
  filters: ReportFilters,
  config: ReportConfig,
): Promise<ReportResult<VwVendas>> {
  const where = buildWhere(config, filters) as Prisma.VwVendasWhereInput;
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

export { ReportFilters, ReportResult };

