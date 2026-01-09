"use client";

type Props = {
  companyId: string;
  hasConnection: boolean;
  reportName: string;
};

export function SyncEmptyState({ companyId, hasConnection, reportName }: Props) {
  const handleSync = async () => {
    const res = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    
    if (res.ok) {
      window.location.reload();
    } else {
      alert("Erro ao sincronizar. Tente novamente.");
    }
  };

  if (!hasConnection) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/30 px-6 py-16">
        <div className="text-6xl mb-4">🔌</div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">
          Conecte ao Tiny ERP
        </h3>
        <p className="text-sm text-slate-400 text-center max-w-md mb-6">
          Para visualizar dados de {reportName}, conecte sua empresa ao Tiny ERP primeiro.
        </p>
        <a
          href="/admin/conexoes-tiny"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Conectar agora
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/30 px-6 py-16">
      <div className="text-6xl mb-4">📊</div>
      <h3 className="text-xl font-semibold text-slate-200 mb-2">
        Nenhum dado encontrado
      </h3>
      <p className="text-sm text-slate-400 text-center max-w-md mb-6">
        Ainda não há registros de {reportName}. Execute uma sincronização para importar dados do Tiny ERP.
      </p>
      <button
        onClick={handleSync}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
      >
        Sincronizar dados
      </button>
    </div>
  );
}

