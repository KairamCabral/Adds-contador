"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
};

export function SyncNowButton({ companyId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Timeout de 360 segundos (6 minutos)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 780000); // 13min (backend tem 12min)
      
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(data.error || "Falha na sincronização");
      }
      
      const result = await res.json();
      console.log("[Sync] Resultado:", result);
      
      // Aguardar 3 segundos para sync processar
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
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
    <div className="flex flex-col gap-1">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-sky-900/40 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-800/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin text-sky-300"
            xmlns="http://www.w3.org/2000/svg"
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {loading ? "Sincronizando..." : "Sincronizar agora"}
      </button>
      {error && (
        <p className="text-xs text-red-400">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}

