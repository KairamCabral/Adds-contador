"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./toast";

type Props = {
  companyId: string;
  lastSync?: {
    date: Date;
    status: string;
  };
};

type SyncStats = {
  totalProcessed?: number;
  moduleStats?: Array<{
    module: string;
    processed: number;
  }>;
};

export function SyncControlsInline({ companyId, lastSync }: Props) {
  const isDev = process.env.NODE_ENV === 'development';
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncMode, setSyncMode] = useState<"dev" | "month">("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return lastMonth.toISOString().slice(0, 7);
  });
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  // Polling inteligente com exponential backoff
  useEffect(() => {
    if (!loading) return;

    let completedOnce = false;
    let attempts = 0;
    let currentInterval = 2000; // Começar com 2s
    let intervalId: NodeJS.Timeout | undefined = undefined;

    const checkSyncStatus = async () => {
      try {
        const res = await fetch(`/api/admin/sync/status?companyId=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          
          // Atualizar stats se disponível
          if (data.lastSync?.stats) {
            setSyncStats(data.lastSync.stats);
            
            // Simular progresso baseado em stats
            const total = data.lastSync.stats.totalProcessed || 0;
            if (total > 0) {
              setProgress(Math.min(90, Math.floor((total / 10) * 10)));
            }
          } else {
            // Progresso incremental sem stats
            setProgress((prev) => Math.min(85, prev + 5));
          }
          
          // Se a última sincronização não está mais RUNNING
          if (data.lastSync?.status && data.lastSync.status !== "RUNNING") {
            if (!completedOnce) {
              completedOnce = true;
              setProgress(100);
              
              // Determinar tipo de notificação
              if (data.lastSync.status === "SUCCESS") {
                const total = data.lastSync.stats?.totalProcessed || 0;
                showToast.success(
                  `✨ Sincronização concluída! ${total > 0 ? `${total} registros atualizados.` : ''}`
                );
              } else if (data.lastSync.status === "FAILED") {
                showToast.error("❌ Falha na sincronização. Tente novamente.");
              }
              
              // Limpar timers
              clearTimeout(timeoutId);
              clearTimeout(intervalId);
              
              // Aguardar animação e atualizar
              setTimeout(() => {
                setLoading(false);
                setSyncStats(null);
                setProgress(0);
                router.refresh();
              }, 1000);
            }
            return;
          }
          
          // Exponential backoff após 5 tentativas
          attempts++;
          if (attempts > 5 && currentInterval < 10000) {
            currentInterval = Math.min(currentInterval * 1.5, 10000); // Max 10s
          }
          
          // Agendar próxima verificação
          intervalId = setTimeout(checkSyncStatus, currentInterval);
        }
      } catch (err) {
        console.error("Error checking sync status:", err);
        // Retry com backoff mesmo em erro
        intervalId = setTimeout(checkSyncStatus, currentInterval);
      }
    };
    
    // Timeout máximo de 13 minutos
    const timeoutId = setTimeout(() => {
      clearTimeout(intervalId);
      setLoading(false);
      setSyncStats(null);
      setProgress(0);
      showToast.error("⏱️ Tempo limite excedido. Verifique o status da sincronização.");
      router.refresh();
    }, 780000);

    // Iniciar polling
    checkSyncStatus();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(intervalId);
    };
  }, [loading, companyId, router]);

  const handleSync = async () => {
    setLoading(true);
    setShowDatePicker(false);
    setProgress(10);
    setSyncStats(null);

    // Notificação inicial
    const periodLabel = syncMode === "dev" 
      ? "últimos 3 dias" 
      : getMonthLabel();
    showToast.info(`🔄 Iniciando sincronização: ${periodLabel}`);

    try {
      let endpoint = "/api/admin/sync";
      let body: Record<string, unknown> = { companyId };

      if (syncMode === "dev") {
        // Modo desenvolvimento: apenas últimos 3 dias
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        endpoint = "/api/admin/sync/period";
        body = {
          companyId,
          startDate: threeDaysAgo.toISOString(),
          endDate: new Date().toISOString(),
        };
      } else if (syncMode === "month" && selectedMonth) {
        const [year, month] = selectedMonth.split("-").map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

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
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(data.error || "Falha na sincronização");
      }

      setProgress(20);
      // O polling vai cuidar do refresh quando terminar
    } catch (err) {
      console.error("Sync error:", err);
      showToast.error("❌ Erro ao iniciar sincronização");
      setLoading(false);
      setProgress(0);
      setSyncStats(null);
    }
  };

  // Formatar nome do mês selecionado
  const getMonthLabel = () => {
    const [year, month] = selectedMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Progress Bar - Aparece durante sincronização */}
      {loading && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status Indicator */}
      {lastSync && (
        <div 
          className={`h-2 w-2 rounded-full ${
            lastSync.status === "SUCCESS" ? "bg-emerald-500" :
            lastSync.status === "RUNNING" || loading ? "animate-pulse bg-amber-500" : "bg-red-500"
          }`}
          title={lastSync.status === "SUCCESS" ? "Última sync concluída" : 
                 lastSync.status === "RUNNING" || loading ? "Sincronizando..." : "Erro na última sync"}
        />
      )}

      {/* Sync Stats Counter - Aparece durante sincronização */}
      {loading && syncStats && syncStats.totalProcessed !== undefined && syncStats.totalProcessed > 0 && (
        <div className="flex items-center gap-1.5 rounded bg-slate-800/80 px-2 py-1 backdrop-blur-sm">
          <svg className="h-3 w-3 text-sky-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-medium text-slate-300">
            {syncStats.totalProcessed}
          </span>
        </div>
      )}

      {/* Date Selector - Mais Visível e Intuitivo */}
      <div className="relative">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-750 disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="capitalize">{getMonthLabel()}</span>
          <svg className={`h-3 w-3 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown melhorado */}
        {showDatePicker && (
          <div className="absolute right-0 top-full mt-2 z-10 min-w-[200px] rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="text-xs font-medium text-slate-300">Selecione o período</span>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-500">
                  Mês/Ano
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setSyncMode("month");
                  }}
                  max={new Date().toISOString().slice(0, 7)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Atalhos rápidos */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase tracking-wider text-slate-500">
                  Atalhos
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      const now = new Date();
                      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      setSelectedMonth(lastMonth.toISOString().slice(0, 7));
                      setSyncMode("month");
                    }}
                    className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Mês passado
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setSelectedMonth(now.toISOString().slice(0, 7));
                      setSyncMode("month");
                    }}
                    className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Este mês
                  </button>
                </div>
              </div>

              {isDev && (
                <div className="border-t border-slate-700 pt-2">
                  <button
                    onClick={() => {
                      setSyncMode("dev");
                      setShowDatePicker(false);
                    }}
                    className={`w-full rounded px-2 py-1.5 text-xs font-medium ${
                      syncMode === "dev"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    🔧 Dev: últimos 3 dias
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sync Button - Mais destacado */}
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Sincronizando...</span>
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Sincronizar</span>
          </>
        )}
      </button>
    </div>
  );
}

