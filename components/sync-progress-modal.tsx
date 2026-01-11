"use client";

import { useEffect, useState, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, Loader2, XCircle } from "lucide-react";

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
        setProgress(data.run.progress);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Sincronização em Andamento</h2>
            <p className="text-sm text-gray-600 mt-1">
              {status === "QUEUED" && "Preparando..."}
              {status === "RUNNING" && `Executando: ${currentModule ? MODULE_NAMES[currentModule] || currentModule : "..."}`}
              {status === "DONE" && "Concluída com sucesso!"}
              {status === "FAILED" && "Concluída com erros"}
              {status === "CANCELED" && "Cancelada"}
            </p>
          </div>
          {isDone && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Status Geral */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Total processado:
              </span>
              <span className="text-lg font-semibold text-blue-600">
                {totalProcessed} registros
              </span>
            </div>
          </div>

          {/* Módulos */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Módulos:</h3>
            {moduleKeys.map((key) => {
              const module = modules[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(module.status)}
                    <div>
                      <div className="font-medium text-sm">
                        {MODULE_NAMES[key] || key}
                      </div>
                      {module.status === "done" && (
                        <div className="text-xs text-gray-600">
                          {module.processed} processados
                          {module.skipped ? `, ${module.skipped} pulados` : ""}
                        </div>
                      )}
                      {module.status === "failed" && module.errors && (
                        <div className="text-xs text-red-600">
                          {module.errors[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  {module.status === "running" && (
                    <span className="text-xs text-blue-600 animate-pulse">
                      Executando...
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Erro geral */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-900 text-sm">Erro:</div>
                  <div className="text-sm text-red-700 mt-1">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Logs recentes */}
          {logs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Logs recentes:
              </h3>
              <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-300 max-h-40 overflow-y-auto">
                {logs.slice(0, 10).map((log, idx) => (
                  <div key={idx} className="mb-1">
                    <span className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {" "}
                    <span
                      className={
                        log.level === "error"
                          ? "text-red-400"
                          : log.level === "warn"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }
                    >
                      [{log.level}]
                    </span>
                    {" "}
                    {log.module && <span className="text-blue-400">[{log.module}]</span>}
                    {" "}
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex justify-between items-center">
          {!isDone && (
            <button
              onClick={cancelSync}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
          {isDone && (
            <button
              onClick={onClose}
              className="ml-auto px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
