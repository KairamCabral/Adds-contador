import React from "react";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";

import { auth } from "@/auth";
import SyncControlsInline from "@/components/sync-controls-lazy";
import { LogoutButton } from "@/components/logout-button";
import { ReportTabs } from "@/components/report-tabs";
import { SyncEmptyState } from "@/components/sync-empty-state";
import { prisma } from "@/lib/db";
import { fetchReport } from "@/lib/reports";
import { reports, ReportView } from "../config";
import { getDefaultCompanyId } from "@/lib/company";

type SearchParams = {
  companyId?: string;
  start?: string;
  end?: string;
  status?: string;
  search?: string;
  page?: string;
};

const formatValue = (value: unknown, columnKey?: string): React.ReactNode => {
  if (value instanceof Date) {
    // Detectar "hora fake" de timezone offset (21:00, 22:00, 23:00, 00:00)
    const hour = value.getHours();
    const minute = value.getMinutes();
    const isFakeTime = (hour === 0 || hour === 21 || hour === 22 || hour === 23) && minute === 0;
    
    if (isFakeTime) {
      // Mostrar apenas data (API Tiny não fornece hora real)
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(value);
    } else {
      // Mostrar data + hora (hora real da API)
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(value);
    }
  }

  // Detectar se é campo de quantidade (número inteiro sem decimais)
  const isQuantityField = columnKey && (
    columnKey === 'quantidade' || 
    columnKey === 'tituloId' ||
    columnKey === 'id' ||
    columnKey.toLowerCase().includes('qtd') ||
    columnKey.toLowerCase().includes('quantidade')
  );

  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const num = (value as { toNumber: () => number }).toNumber();
    
    if (isQuantityField) {
      // Quantidade: número simples sem decimais (ex: 2, 10, 150)
      return num % 1 === 0 ? num.toString() : num.toFixed(0);
    }
    
    // Dinheiro: formato brasileiro com 2 casas decimais (ex: 1.234,56)
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (typeof value === "number") {
    if (isQuantityField) {
      // Quantidade: número simples sem decimais (ex: 2, 10, 150)
      return value % 1 === 0 ? value.toString() : value.toFixed(0);
    }
    
    // Dinheiro: formato brasileiro com 2 casas decimais (ex: 1.234,56)
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

  // Usar empresa padrão (singleton ADDS)
  const selectedCompanyId = await getDefaultCompanyId();

  if (!selectedCompanyId) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
        <h1 className="text-2xl font-semibold">Nenhuma empresa cadastrada</h1>
        <p className="text-slate-400">
          Configure a empresa ADDS Brasil no banco de dados.
        </p>
      </div>
    );
  }

  const page = Number(filters.page ?? "1");

  const lastSync = await prisma.syncRun.findFirst({
    where: { companyId: selectedCompanyId },
    orderBy: { startedAt: "desc" },
  });

  // Verificar se existe conexão Tiny
  const tinyConnection = await prisma.tinyConnection.findFirst({
    where: { companyId: selectedCompanyId },
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
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      {/* Header Fixo com Controles */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        {/* Barra de Controles - Logo e Sync */}
        <div className="border-b border-slate-800/50">
          <div className="mx-auto max-w-[1920px] px-6">
            <div className="flex items-center justify-between gap-6 py-3">
              {/* Info do Relatório */}
              <div className="flex items-center gap-6">
                {/* Logo */}
                <Image 
                  src="/Logo-cor-adds.webp" 
                  alt="ADDS"
                  width={120}
                  height={32}
                  priority
                  className="h-8 w-auto"
                />
                
                <div>
                  <h1 className="text-lg font-bold text-white">{config.title}</h1>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    {!tinyConnection ? (
                      <span className="text-amber-400">
                        ⚠️ <a href="/admin/conexoes-tiny" className="underline hover:text-amber-300">Conectar Tiny</a>
                      </span>
                    ) : (
                      <span className="text-emerald-400">✓ Conectado</span>
                    )}
                    {lastSync && (
                      <>
                        <span className="text-slate-700">•</span>
                        <span>
                          Sync: {new Date(lastSync.startedAt).toLocaleString("pt-BR", { 
                            day: "2-digit", 
                            month: "2-digit", 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Controles de Ação */}
              <div className="flex items-center gap-2">
                {/* Sincronização Inline */}
                <SyncControlsInline
                  companyId={selectedCompanyId}
                  lastSync={
                    lastSync
                      ? {
                          date: lastSync.startedAt,
                          status: lastSync.status,
                        }
                      : undefined
                  }
                />

                {/* Logout */}
                <div className="border-l border-slate-800 pl-2">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navegação por Abas */}
        <ReportTabs />
      </header>

      {/* Conteúdo Principal - Largura Total */}
      <main className="mx-auto max-w-[1920px] px-6 py-6">

        {/* Área Unificada: Filtros + Exports */}
        <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          {/* Cabeçalho com Resumo */}
          <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <div className="text-sm">
                  {(filters.start || filters.end || filters.search) ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sky-400">Filtros ativos:</span>
                      <div className="flex gap-2">
                        {filters.start && (
                          <span className="rounded-full bg-sky-600/20 px-2 py-0.5 text-xs text-sky-300">
                            De: {new Date(filters.start).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {filters.end && (
                          <span className="rounded-full bg-sky-600/20 px-2 py-0.5 text-xs text-sky-300">
                            Até: {new Date(filters.end).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {filters.search && (
                          <span className="rounded-full bg-sky-600/20 px-2 py-0.5 text-xs text-sky-300">
                            &ldquo;{filters.search}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">Filtrar dados por período ou buscar</span>
                  )}
                </div>
              </div>
              
              {/* Botões de Export com Indicador */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {data.total} {data.total === 1 ? 'registro' : 'registros'}
                </span>
                <div className="h-4 w-px bg-slate-700"></div>
                <a
                  href={`/api/exports/${view}?format=xlsx&${queryString}`}
                  className="group flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-all hover:bg-emerald-600/20 hover:border-emerald-600/50"
                  download
                  title={`Exportar ${data.total} registros para Excel`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                  </svg>
                  <span>Excel</span>
                </a>
                <a
                  href={`/api/exports/${view}?format=json&${queryString}`}
                  className="group flex items-center gap-1.5 rounded-lg border border-blue-600/30 bg-blue-600/10 px-2.5 py-1.5 text-xs font-medium text-blue-300 transition-all hover:bg-blue-600/20 hover:border-blue-600/50"
                  download
                  title={`Exportar ${data.total} registros para JSON`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                  </svg>
                  <span>JSON</span>
                </a>
              </div>
            </div>
          </div>

          {/* Formulário de Filtros */}
          <div className="p-4">
            <form className="flex flex-wrap gap-3" method="get">
              <div className="flex gap-2">
                <input
                  type="date"
                  name="start"
                  defaultValue={filters.start}
                  placeholder="Data inicial"
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="flex items-center text-slate-600">→</span>
                <input
                  type="date"
                  name="end"
                  defaultValue={filters.end}
                  placeholder="Data final"
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              
              <input
                type="text"
                name="search"
                placeholder="Buscar..."
                defaultValue={filters.search}
                className="flex-1 min-w-[200px] rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              
              <button
                type="submit"
                className="flex items-center gap-2 rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Aplicar
              </button>
              
              {(filters.start || filters.end || filters.search) && (
                <a
                  href={`/relatorios/${view}`}
                  className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpar
                </a>
              )}
            </form>
          </div>
        </div>

        {/* Tabela ou Empty State */}
        {data.items.length === 0 ? (
            <SyncEmptyState
              companyId={selectedCompanyId}
              hasConnection={!!tinyConnection}
              reportName={config.title}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-800 bg-slate-900/80">
                    <tr>
                      {config.columns.map((col) => (
                        <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        {config.columns.map((col) => (
                          <td key={col.key} className="px-4 py-3 text-slate-300">
                            {formatValue((item as Record<string, unknown>)[col.key], col.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-400">
                <span>
                  Página {data.page} • {data.total} registros
                </span>
                <div className="flex gap-2">
                  <a
                    href={`?${buildParams({ page: Math.max(1, data.page - 1).toString() })}`}
                    className={`rounded border px-3 py-1 text-xs ${
                      data.page <= 1
                        ? "cursor-not-allowed border-slate-800 text-slate-600"
                        : "border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    ← Anterior
                  </a>
                  <a
                    href={`?${buildParams({ page: (data.page + 1).toString() })}`}
                    className={`rounded border px-3 py-1 text-xs ${
                      data.items.length < data.pageSize
                        ? "cursor-not-allowed border-slate-800 text-slate-600"
                        : "border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Próxima →
                  </a>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
