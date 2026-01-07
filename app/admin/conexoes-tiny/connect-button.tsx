"use client";

import { useState } from "react";

export function ConnectTinyButton({ companyId }: { companyId: string }) {
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

