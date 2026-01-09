"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { reports, ReportView } from "@/app/relatorios/config";

export function ReportTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Extrair view atual do pathname
  const currentView = pathname.split("/").pop() as ReportView;

  // Manter filtros de período ao trocar de aba
  const buildUrl = (view: ReportView) => {
    const params = new URLSearchParams();
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    
    const queryString = params.toString();
    return `/relatorios/${view}${queryString ? `?${queryString}` : ""}`;
  };

  const tabs = [
    { view: "vw_vendas" as ReportView, label: "Vendas", icon: "📊" },
    { view: "vw_contas_receber_posicao" as ReportView, label: "Contas a Receber", icon: "💰" },
    { view: "vw_contas_pagar" as ReportView, label: "Contas a Pagar", icon: "💳" },
    { view: "vw_contas_recebidas" as ReportView, label: "Contas Recebidas", icon: "✅" },
    { view: "vw_contas_pagas" as ReportView, label: "Contas Pagas", icon: "✔️" },
    { view: "vw_estoque" as ReportView, label: "Estoque", icon: "📦" },
  ];

  return (
    <div className="border-b border-slate-800">
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = currentView === tab.view;
          const config = reports[tab.view];
          
          return (
            <Link
              key={tab.view}
              href={buildUrl(tab.view)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium
                border-b-2 whitespace-nowrap transition-colors
                ${
                  isActive
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

