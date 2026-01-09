import { reports, ReportView } from "@/app/relatorios/config";
import { buildWhere } from "@/lib/reports";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type ExportFilters = {
  companyId: string;
  start?: string;
  end?: string;
  status?: string;
  search?: string;
  limit?: number;
};

export async function fetchRowsForExport(
  view: ReportView,
  filters: ExportFilters,
): Promise<Record<string, unknown>[]> {
  const config = reports[view];
  const where = buildWhere(config, filters);
  const take = Math.min(filters.limit ?? 5000, 10000);

  switch (view) {
    case "vw_vendas": {
      const vendasWhere = where as Prisma.VwVendasWhereInput;
      // Excluir pedidos "Em aberto"
      vendasWhere.status = {
        not: "Em aberto",
      };
      return prisma.vwVendas.findMany({
        where: vendasWhere,
        orderBy: { dataHora: "desc" },
        take,
      });
    }
    case "vw_contas_receber_posicao":
      return prisma.vwContasReceberPosicao.findMany({
        where: where as Prisma.VwContasReceberPosicaoWhereInput,
        orderBy: { dataPosicao: "desc" },
        take,
      });
    case "vw_contas_pagar":
      return prisma.vwContasPagar.findMany({
        where: where as Prisma.VwContasPagarWhereInput,
        orderBy: { dataVencimento: "desc" },
        take,
      });
    case "vw_contas_pagas":
      return prisma.vwContasPagas.findMany({
        where: where as Prisma.VwContasPagasWhereInput,
        orderBy: { dataPagamento: "desc" },
        take,
      });
    case "vw_estoque":
      return prisma.vwEstoque.findMany({
        where: where as Prisma.VwEstoqueWhereInput,
        orderBy: { dataReferencia: "desc" },
        take,
      });
    case "vw_contas_recebidas":
      return prisma.vwContasRecebidas.findMany({
        where: where as Prisma.VwContasRecebidasWhereInput,
        orderBy: { dataRecebimento: "desc" },
        take,
      });
    default:
      return [];
  }
}

