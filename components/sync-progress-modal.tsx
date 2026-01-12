"use client";

import { useEffect, useState, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, Loader2, XCircle, Clock, Zap } from "lucide-react";

interface SyncProgressModalProps {
  runId: string;
  onClose: () => void;
}

interface ModuleProgress {
  status: "pending" | "running" | "done" | "failed";
  processed: number;
  skipped?: number;
  errors?: string[];
}

interface SyncProgress {
  modules: {
    [key: string]: ModuleProgress;
  };
}

interface SyncLog {
  timestamp: string;
  level: string;
  message: string;
  module?: string;
}

const MODULE_NAMES: Record<string, string> = {
  vw_vendas: "Vendas",
  vw_contas_receber_posicao: "Contas a Receber",
  vw_contas_pagar: "Contas a Pagar",
  vw_contas_pagas: "Contas Pagas",
  vw_contas_recebidas: "Contas Recebidas",
  vw_estoque: "Estoque",
};

export function SyncProgressModal({ runId, onClose }: SyncProgressModalProps) {
  const [status, setStatus] = useState<string>("QUEUED");
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [currentModule, setCurrentModule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Buscar status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sync/v2/status?runId=${runId}`);
      const data = await res.json();

      if (data.success) {
        setStatus(data.run.status);
        // Corrigir: progressJson é o objeto com módulos
        setProgress(data.run.progressJson || { modules: {} });
        setCurrentModule(data.run.currentModule);
        setLogs(data.logs || []);
        setError(data.run.errorMessage);
      }
    } catch (err) {
      console.error("Erro ao buscar status:", err);
    }
  }, [runId]);

  // Executar um passo
  const executeStep = useCallback(async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    try {
      const res = await fetch("/api/admin/sync/v2/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus(data.status);
        setProgress(data.progress);
        setCurrentModule(data.currentModule);

        // Se ainda há trabalho, executar próximo passo
        if (data.hasMore && data.status === "RUNNING") {
          setTimeout(() => executeStep(), 1000);
        }
      }
    } catch (err) {
      console.error("Erro ao executar passo:", err);
    } finally {
      setIsExecuting(false);
    }
  }, [runId, isExecuting]);

  // Iniciar sync
  const startSync = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/v2/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus(data.status);
        // Iniciar execução dos passos
        setTimeout(() => executeStep(), 500);
      }
    } catch (err) {
      console.error("Erro ao iniciar sync:", err);
    }
  }, [runId, executeStep]);

  // Cancelar sync
  const cancelSync = useCallback(async () => {
    try {
      await fetch("/api/admin/sync/v2/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      await fetchStatus();
    } catch (err) {
      console.error("Erro ao cancelar sync:", err);
    }
  }, [runId, fetchStatus]);

  // Iniciar sync quando modal abre
  useEffect(() => {
    if (status === "QUEUED") {
      startSync();
    }
  }, [status, startSync]);

  // Polling do status enquanto está rodando
  useEffect(() => {
    if (status === "RUNNING") {
      const interval = setInterval(fetchStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [status, fetchStatus]);

  // Ícone de status
  const getStatusIcon = (moduleStatus: string) => {
    switch (moduleStatus) {
      case "done":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "running":
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "pending":
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
      default:
        return null;
    }
  };

  const modules = progress?.modules || {};
  const moduleKeys = Object.keys(modules);

  const totalProcessed = moduleKeys.reduce(
    (sum, key) => sum + (modules[key]?.processed || 0),
    0
  );

  const isDone = status === "DONE" || status === "FAILED" || status === "CANCELED";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header com Gradiente */}
        <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 p-6 text-white">
          {/* Padrão de fundo */}
          <div className="absolute inset-0 bg-grid-white/10" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                {status === "RUNNING" && <Loader2 className="h-6 w-6 animate-spin" />}
                {status === "QUEUED" && <Clock className="h-6 w-6" />}
                {status === "DONE" && <CheckCircle2 className="h-6 w-6" />}
                {status === "FAILED" && <XCircle className="h-6 w-6" />}
                {status === "CANCELED" && <X className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {status === "QUEUED" && "Preparando Sincronização"}
                  {status === "RUNNING" && "Sincronizando Dados"}
                  {status === "DONE" && "Sincronização Concluída"}
                  {status === "FAILED" && "Sincronização com Erros"}
                  {status === "CANCELED" && "Sincronização Cancelada"}
                </h2>
                <p className="mt-1 text-sm text-blue-100">
                  {status === "QUEUED" && "Aguarde enquanto preparamos os módulos..."}
                  {status === "RUNNING" && currentModule && (
                    <span className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5" />
                      Processando: {MODULE_NAMES[currentModule] || currentModule}
                    </span>
                  )}
                  {status === "DONE" && "Todos os dados foram sincronizados com sucesso!"}
                  {status === "FAILED" && "Alguns módulos falharam durante a sincronização"}
                  {status === "CANCELED" && "O processo foi cancelado pelo usuário"}
                </p>
              </div>
            </div>
            {isDone && (
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card de Resumo */}
          <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-blue-200/30 blur-2xl" />
            <div className="relative">
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-lg bg-blue-500/10 p-1.5">
                  <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-700">Total Processado</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-blue-600">
                  {totalProcessed.toLocaleString('pt-BR')}
                </span>
                <span className="text-lg text-slate-600">registros</span>
              </div>
            </div>
          </div>

          {/* Módulos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-slate-200">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                  style={{ 
                    width: `${moduleKeys.length > 0 ? (moduleKeys.filter(k => modules[k]?.status === 'done').length / moduleKeys.length) * 100 : 0}%` 
                  }}
                />
              </div>
              <span className="text-xs font-medium text-slate-600">
                {moduleKeys.filter(k => modules[k]?.status === 'done').length}/{moduleKeys.length}
              </span>
            </div>

            <div className="space-y-2">
              {moduleKeys.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
                  Nenhum módulo configurado para sincronização
                </div>
              )}
              
              {moduleKeys.map((key) => {
                const moduleData = modules[key];
                const isActive = moduleData.status === "running";
                
                return (
                  <div
                    key={key}
                    className={`group relative overflow-hidden rounded-lg border p-4 transition-all duration-200 ${
                      isActive
                        ? "border-blue-200 bg-blue-50/50 shadow-md"
                        : moduleData.status === "done"
                        ? "border-green-200 bg-green-50/30"
                        : moduleData.status === "failed"
                        ? "border-red-200 bg-red-50/30"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent animate-pulse" />
                    )}
                    
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 ${isActive ? 'animate-bounce' : ''}`}>
                          {getStatusIcon(moduleData.status)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {MODULE_NAMES[key] || key}
                          </div>
                          {moduleData.status === "done" && (
                            <div className="mt-0.5 text-xs text-slate-600">
                              ✓ {moduleData.processed.toLocaleString('pt-BR')} processados
                              {moduleData.skipped ? ` • ${moduleData.skipped} pulados` : ""}
                            </div>
                          )}
                          {moduleData.status === "running" && (
                            <div className="mt-0.5 text-xs font-medium text-blue-600">
                              {moduleData.processed.toLocaleString('pt-BR')} processados até agora...
                            </div>
                          )}
                          {moduleData.status === "failed" && moduleData.errors && (
                            <div className="mt-0.5 text-xs text-red-600">
                              ✗ {moduleData.errors[0]}
                            </div>
                          )}
                          {moduleData.status === "pending" && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              Aguardando...
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isActive && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                          <span className="text-xs font-medium text-blue-600">Em execução</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Erro geral */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-50/50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 rounded-lg bg-red-100 p-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-red-900">Erro na Sincronização</div>
                  <div className="mt-1 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Logs recentes */}
          {logs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-slate-100 p-1.5">
                  <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">Logs de Execução</h3>
              </div>
              <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto">
                {logs.slice(0, 15).map((log, idx) => (
                  <div key={idx} className="mb-1 leading-relaxed">
                    <span className="text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                    {" "}
                    <span
                      className={`font-semibold ${
                        log.level === "error"
                          ? "text-red-400"
                          : log.level === "warn"
                          ? "text-yellow-400"
                          : "text-emerald-400"
                      }`}
                    >
                      [{log.level.toUpperCase()}]
                    </span>
                    {" "}
                    {log.module && <span className="text-blue-400">[{log.module}]</span>}
                    {" "}
                    <span className="text-slate-200">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50/50 p-6">
          <div className="flex items-center justify-between">
            {!isDone && (
              <>
                <button
                  onClick={cancelSync}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-95"
                >
                  Cancelar Sincronização
                </button>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span>Sincronizando...</span>
                </div>
              </>
            )}
            {isDone && (
              <button
                onClick={onClose}
                className="ml-auto rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Fechar e Atualizar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
