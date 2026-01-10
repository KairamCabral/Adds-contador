"use client";

import { useState } from "react";

export function ConnectTinyButton({ 
  companyId, 
  isConnected 
}: { 
  companyId: string;
  isConnected: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tiny/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });

    if (!res.ok) {
      setLoading(false);
      alert("Erro ao iniciar conexão com a Tiny");
      return;
    }

    const data = (await res.json()) as { url?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("URL de autorização não retornada");
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar do Tiny ERP? Você precisará reconectar para sincronizar dados novamente.")) {
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/tiny/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });

    if (!res.ok) {
      alert("Erro ao desconectar");
      setLoading(false);
      return;
    }

    window.location.reload();
  };

  if (isConnected) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Redirecionando..." : "Reconectar"}
        </button>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Desconectando..." : "Desconectar"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Redirecionando..." : "Conectar Tiny"}
    </button>
  );
}

