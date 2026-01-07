"use client";

import { useState } from "react";

type Props = {
  companyId: string;
};

export function SyncNowButton({ companyId }: Props) {
  const [loading, setLoading] = useState(false);
  const handleSync = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    if (!res.ok) {
      alert("Erro ao disparar sincronização");
    } else {
      alert("Sincronização iniciada");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-70"
    >
      {loading ? "Sincronizando..." : "Sincronizar agora"}
    </button>
  );
}

