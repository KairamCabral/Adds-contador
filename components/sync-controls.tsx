"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
  lastSync?: {
    date: Date;
    status: string;
  };
};

export function SyncControls({ companyId, lastSync }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [syncMode, setSyncMode] = useState<"quick" | "month" | "custom">("quick");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return lastMonth.toISOString().slice(0, 7); // YYYY-MM
  });
  const router = useRouter();

  const handleSync = async (mode: "quick" | "month" | "custom") => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 780000); // 13min

      let endpoint = "/api/admin/sync";
      let body: Record<string, unknown> = { companyId };

      if (mode === "month" && selectedMonth) {
        // Sincronizar mês específico
        const [year, month] = selectedMonth.split("-").map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59); // Último dia do mês

        endpoint = "/api/admin/sync/period";
        body = {
          companyId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(data.error || "Falha na sincronização");
      }

      const result = await res.json();
      console.log("[Sync] Resultado:", result);

      // Mostrar sucesso
      setSuccess(true);

      // Aguardar 2 segundos para mostrar sucesso
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Recarregar página para mostrar novos dados
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Sincronização está demorando mais que o esperado. Verifique em alguns minutos.");
      } else {
        setError(err instanceof Error ? err.message : "Erro ao sincronizar");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Título Compacto */}
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-200">Sincronização</h3>
      </div>
      
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 backdrop-blur-sm">

        {/* Status Compacto */}
        {lastSync && (
          <div className={`mb-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
            lastSync.status === "SUCCESS"
              ? "bg-emerald-500/10 text-emerald-400"
              : lastSync.status === "RUNNING"
              ? "animate-pulse bg-amber-500/10 text-amber-400"
              : "bg-red-500/10 text-red-400"
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              lastSync.status === "SUCCESS" ? "bg-emerald-400" :
              lastSync.status === "RUNNING" ? "bg-amber-400" : "bg-red-400"
            }`}></div>
            <span className="flex-1 truncate">
              {new Date(lastSync.date).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* Modo - Compacto */}
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setSyncMode("quick")}
            disabled={loading}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-all ${
              syncMode === "quick"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
            }`}
          >
            30 dias
          </button>
          <button
            onClick={() => setSyncMode("month")}
            disabled={loading}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-all ${
              syncMode === "month"
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
            }`}
          >
            Por mês
          </button>
        </div>

        {/* Seletor de Mês */}
        {syncMode === "month" && (
          <div className="mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              max={new Date().toISOString().slice(0, 7)}
              disabled={loading}
              className="w-full rounded border border-slate-600/50 bg-slate-900/60 px-3 py-2 text-xs text-white transition-colors hover:border-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
            />
          </div>
        )}

        {/* Botão */}
        <button
          onClick={() => handleSync(syncMode)}
          disabled={loading}
          className="w-full rounded bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 active:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sincronizando...
            </span>
          ) : success ? (
            "✓ Sincronizado"
          ) : (
            <>Sincronizar</>
          )}
        </button>

        {/* Mensagens */}
        {error && (
          <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

