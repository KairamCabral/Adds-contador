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

export function SyncControlsInline({ companyId, lastSync }: Props) {
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [syncMode, setSyncMode] = useState<"quick" | "month">("quick");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return lastMonth.toISOString().slice(0, 7);
  });
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    setShowOptions(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 780000);

      let endpoint = "/api/admin/sync";
      let body: Record<string, unknown> = { companyId };

      if (syncMode === "month" && selectedMonth) {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(data.error || "Falha na sincronização");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      router.refresh();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Status Indicator */}
      {lastSync && (
        <div className={`h-2 w-2 rounded-full ${
          lastSync.status === "SUCCESS" ? "bg-emerald-500" :
          lastSync.status === "RUNNING" ? "animate-pulse bg-amber-500" : "bg-red-500"
        }`} />
      )}

      {/* Mode Selector */}
      <div className="flex rounded border border-slate-700 overflow-hidden">
        <button
          onClick={() => setSyncMode("quick")}
          disabled={loading}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            syncMode === "quick"
              ? "bg-sky-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-slate-300"
          }`}
        >
          30d
        </button>
        <button
          onClick={() => {
            setSyncMode("month");
            setShowOptions(!showOptions);
          }}
          disabled={loading}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            syncMode === "month"
              ? "bg-sky-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-slate-300"
          }`}
        >
          Mês
        </button>
      </div>

      {/* Month Picker Dropdown */}
      {showOptions && syncMode === "month" && (
        <div className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            max={new Date().toISOString().slice(0, 7)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white"
          />
        </div>
      )}

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={loading}
        className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sync...
          </span>
        ) : (
          "Sincronizar"
        )}
      </button>
    </div>
  );
}

