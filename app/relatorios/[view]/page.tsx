import React from "react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { SyncNowButton } from "@/components/sync-now-button";
import { prisma } from "@/lib/db";
import { fetchReport } from "@/lib/reports";
import { reports, ReportView } from "../config";

type SearchParams = {
  companyId?: string;
  start?: string;
  end?: string;
  status?: string;
  search?: string;
  page?: string;
};

const formatValue = (value: unknown): React.ReactNode => {
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR");
  }

  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const num = (value as { toNumber: () => number }).toNumber();
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (typeof value === "string") {
    return value;
  }

  return value == null ? "—" : String(value);
};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { view: viewParam } = await params;
  const view = viewParam as ReportView;
  const filters = await searchParams;
  const config = reports[view];
  if (!config) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const sessionCompanies = session.user.companies as Array<{ companyId: string }>;
  const companyIds = sessionCompanies.map((c) => c.companyId);
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    orderBy: { name: "asc" },
  });

  const selectedCompanyId =
    filters.companyId ?? companies[0]?.id ?? undefined;

  if (!selectedCompanyId) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
        <h1 className="text-2xl font-semibold">Nenhuma empresa disponível</h1>
        <p className="text-slate-400">
          Adicione uma empresa e conecte ao Tiny para visualizar relatórios.
        </p>
      </div>
    );
  }

  const page = Number(filters.page ?? "1");

  const lastSync = await prisma.syncRun.findFirst({
    where: { companyId: selectedCompanyId },
    orderBy: { startedAt: "desc" },
  });

  const data = await fetchReport(view, {
    companyId: selectedCompanyId,
    start: filters.start,
    end: filters.end,
    status: filters.status,
    search: filters.search,
    page,
    pageSize: 20,
  });

  const buildParams = (extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("companyId", selectedCompanyId);
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => params.set(key, value));
    }
    return params.toString();
  };

  const queryString = buildParams();

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Relatórios
              </p>
              <h1 className="text-2xl font-semibold">{config.title}</h1>
              <p className="text-sm text-slate-400">
                Último sync:{" "}
                {lastSync
                  ? `${lastSync.status} em ${new Date(
                      lastSync.startedAt,
                    ).toLocaleString("pt-BR")}`
                  : "Nunca sincronizado"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SyncNowButton companyId={selectedCompanyId} />
              <a
                className="rounded-lg border border-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900"
                href={`/api/exports/${view}.csv?${queryString}`}
              >
                Exportar CSV
              </a>
              <a
                className="rounded-lg border border-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900"
                href={`/api/exports/${view}.xlsx?${queryString}`}
              >
                Exportar XLSX
              </a>
            </div>
          </div>

          <form className="grid grid-cols-1 gap-3 md:grid-cols-5" method="get">
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              Empresa
              <select
                name="companyId"
                defaultValue={selectedCompanyId}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              Data inicial
              <input
                type="date"
                name="start"
                defaultValue={filters.start}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              Data final
              <input
                type="date"
                name="end"
                defaultValue={filters.end}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              Status
              <input
                type="text"
                name="status"
                placeholder="ex: pago, aberto"
                defaultValue={filters.status}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              Busca
              <input
                type="text"
                name="search"
                placeholder="cliente, fornecedor, produto"
                defaultValue={filters.search}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <div className="md:col-span-5">
              <button
                type="submit"
                className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                Aplicar filtros
              </button>
            </div>
          </form>
        </header>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-300">
                <tr>
                  {config.columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-semibold">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {data.items.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-400"
                      colSpan={config.columns.length}
                    >
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  data.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      {config.columns.map((col) => (
                        <td key={col.key} className="px-4 py-3">
                          {formatValue((item as Record<string, unknown>)[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <div>
              Página {data.page} • {data.total} registros
            </div>
            <div className="flex items-center gap-2">
              <a
                className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
                href={`?${buildParams({
                  page: Math.max(1, data.page - 1).toString(),
                })}`}
                aria-disabled={data.page <= 1}
              >
                Anterior
              </a>
              <a
                className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
                href={`?${buildParams({
                  page: (data.page + 1).toString(),
                })}`}
                aria-disabled={data.items.length < data.pageSize}
              >
                Próxima
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

