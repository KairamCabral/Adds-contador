"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SyncProgressModal } from "./sync-progress-modal";

type Props = {
  companyId: string;
  lastSync?: {
    date: Date;
    status: string;
  };
};

export function SyncControlsV2({ companyId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [syncMode, setSyncMode] = useState<"quick" | "month">("quick");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return lastMonth.toISOString().slice(0, 7); // YYYY-MM
  });
  const router = useRouter();

  const handleSync = async (mode: "quick" | "month") => {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        companyId,
        syncMode: mode === "quick" ? "incremental" : "period",
      };

      if (mode === "month" && selectedMonth) {
        // Calcular startDate e endDate em UTC do mês selecionado
        const [year, month] = selectedMonth.split("-").map(Number);
        
        // Primeiro dia do mês às 00:00:00.000 UTC
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        
        // Último dia do mês às 23:59:59.999 UTC
        const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const endDate = new Date(Date.UTC(year, month - 1, lastDayOfMonth, 23, 59, 59, 999));
        
        body.startDate = startDate.toISOString();
        body.endDate = endDate.toISOString();
        
        console.log(`[Sync V2] Período: ${selectedMonth} (${body.startDate} a ${body.endDate})`);
      }

      // Criar SyncRun
      const res = await fetch("/api/admin/sync/v2/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(data.error || "Falha ao criar sincronização");
      }

      const result = await res.json();
      console.log("[Sync V2] Criado:", result);

      // Abrir modal com progresso
      setRunId(result.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setRunId(null);
    // Recarregar página para mostrar novos dados
    router.refresh();
  };

  return (
    <>
      {/* Layout Horizontal Compacto */}
      <div className="flex items-center gap-2">
        {/* Seletor de Modo - Pills Horizontais */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-800/60 p-1">
          <button
            onClick={() => setSyncMode("quick")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              syncMode === "quick"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
            title="Sincronização rápida dos últimos 30 dias"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline">Rápido</span>
            <span className="text-[10px] opacity-70">(30d)</span>
          </button>
          <button
            onClick={() => setSyncMode("month")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              syncMode === "month"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
            title="Sincronização por mês específico"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Por Mês</span>
          </button>
        </div>

        {/* Seletor de Mês - Aparece inline quando modo "month" */}
        {syncMode === "month" && (
          <div className="flex items-center gap-1.5">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-8 rounded-md border border-slate-600/50 bg-slate-800/60 px-2.5 text-xs text-slate-200 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              title="Selecione o mês para sincronizar"
            />
          </div>
        )}

        {/* Botão de Sincronizar - Compacto */}
        <button
          onClick={() => handleSync(syncMode)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-blue-500 hover:to-blue-600 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          title={syncMode === "quick" ? "Sincronizar últimos 30 dias" : `Sincronizar ${selectedMonth}`}
        >
          {loading ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="hidden sm:inline">Processando...</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Sincronizar</span>
            </>
          )}
        </button>

        {/* Mensagem de Erro - Toast Compacto */}
        {error && (
          <div className="absolute right-6 top-16 z-30 max-w-sm animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/90 px-3 py-2 shadow-lg backdrop-blur-sm">
              <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-medium text-red-200">Erro ao sincronizar</p>
                <p className="mt-0.5 text-xs text-red-300/80">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="flex-shrink-0 text-red-400 hover:text-red-200 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Progresso */}
      {runId && <SyncProgressModal runId={runId} onClose={handleCloseModal} />}
    </>
  );
}
