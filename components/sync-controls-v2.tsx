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

export function SyncControlsV2({ companyId, lastSync }: Props) {
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
      let body: Record<string, unknown> = {
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
      <div className="space-y-3">
        {/* Título Compacto */}
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <h3 className="text-sm font-semibold text-slate-200">Sincronização</h3>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 backdrop-blur-sm">
          {/* Status Compacto */}
          {lastSync && (
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    lastSync.status === "DONE"
                      ? "bg-emerald-500"
                      : lastSync.status === "FAILED"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }`}
                />
                <span>
                  Última:{" "}
                  {new Date(lastSync.date).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Seletor de Modo */}
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setSyncMode("quick")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                syncMode === "quick"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Rápido (30d)
            </button>
            <button
              onClick={() => setSyncMode("month")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                syncMode === "month"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Por Mês
            </button>
          </div>

          {/* Seletor de Mês */}
          {syncMode === "month" && (
            <div className="mb-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Botão de Sincronizar */}
          <button
            onClick={() => handleSync(syncMode)}
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Criando...
              </span>
            ) : (
              "Sincronizar"
            )}
          </button>

          {/* Mensagens */}
          {error && (
            <div className="mt-3 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Progresso */}
      {runId && <SyncProgressModal runId={runId} onClose={handleCloseModal} />}
    </>
  );
}
