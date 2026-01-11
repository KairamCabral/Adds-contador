"use client";

import { useState } from "react";

type Props = {
  companyId: string;
  startDate?: string;
  endDate?: string;
};

export function SyncV2Button({ companyId, startDate, endDate }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);

  const handleSync = async () => {
    setLoading(true);
    setStatus("Criando sync...");

    try {
      // 1. Criar
      const createRes = await fetch("/api/admin/sync/v2/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, startDate, endDate }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || "Erro ao criar sync");
      }

      const { runId } = createData;

      // 2. Iniciar
      setStatus("Iniciando sync...");
      await fetch("/api/admin/sync/v2/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      // 3. Loop de steps
      let done = false;
      while (!done) {
        setStatus("Processando...");

        const stepRes = await fetch("/api/admin/sync/v2/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId }),
        });

        const stepData = await stepRes.json();

        if (stepData.status === "DONE") {
          done = true;
          setStatus("Concluído!");
          setProgress(100);
        } else if (stepData.status === "ERROR") {
          throw new Error(stepData.error || "Erro no sync");
        } else {
          setProgress(stepData.overallProgress || 0);
          setStatus(`${stepData.currentModule} (${stepData.overallProgress}%)`);
          
          // Aguardar 1.5s antes do próximo step
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Recarregar página
      window.location.reload();
    } catch (error) {
      console.error("Erro no sync:", error);
      setStatus(`Erro: ${error instanceof Error ? error.message : "Desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sincronizando..." : "Sincronizar V2"}
      </button>
      
      {loading && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-32 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm text-gray-400">{status}</span>
        </div>
      )}
    </div>
  );
}
