import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { userHasRole } from "@/lib/authz";
import { Role } from "@prisma/client";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = userHasRole(session, [Role.ADMIN]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Bem-vindo ao Sistema</h1>
            <p className="mt-1 text-sm text-slate-400">
              {session.user.email}
            </p>
          </div>
          <LogoutButton />
        </header>

        {/* Acesso rápido - Relatórios */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-xl font-semibold">📊 Relatórios</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Link
              href="/relatorios/vw_vendas"
              className="group flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4 transition-all hover:border-sky-500 hover:bg-slate-750"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600 text-xl group-hover:bg-sky-500">
                🛒
              </div>
              <div>
                <h3 className="font-semibold">Vendas</h3>
                <p className="text-xs text-slate-400">Ver relatório de vendas</p>
              </div>
            </Link>

            <Link
              href="/relatorios/vw_contas_receber_posicao"
              className="group flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4 transition-all hover:border-emerald-500 hover:bg-slate-750"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-xl group-hover:bg-emerald-500">
                💰
              </div>
              <div>
                <h3 className="font-semibold">Contas a Receber</h3>
                <p className="text-xs text-slate-400">Ver contas a receber</p>
              </div>
            </Link>

            <Link
              href="/relatorios/vw_contas_pagar"
              className="group flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4 transition-all hover:border-orange-500 hover:bg-slate-750"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 text-xl group-hover:bg-orange-500">
                💳
              </div>
              <div>
                <h3 className="font-semibold">Contas a Pagar</h3>
                <p className="text-xs text-slate-400">Ver contas a pagar</p>
              </div>
            </Link>

            <Link
              href="/relatorios/vw_estoque"
              className="group flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4 transition-all hover:border-purple-500 hover:bg-slate-750"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-xl group-hover:bg-purple-500">
                📦
              </div>
              <div>
                <h3 className="font-semibold">Estoque</h3>
                <p className="text-xs text-slate-400">Ver estoque</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Admin - Apenas para administradores */}
        {isAdmin && (
          <section className="rounded-xl border border-amber-800/50 bg-amber-900/10 p-6">
            <h2 className="mb-4 text-xl font-semibold">⚙️ Administração</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Link
                href="/admin/conexoes-tiny"
                className="group flex items-center gap-3 rounded-lg border border-amber-700 bg-amber-900/30 p-4 transition-all hover:border-amber-500 hover:bg-amber-900/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-xl group-hover:bg-amber-500">
                  🔌
                </div>
                <div>
                  <h3 className="font-semibold">Conexões Tiny</h3>
                  <p className="text-xs text-amber-300/70">Gerenciar conexões API</p>
                </div>
              </Link>

              <Link
                href="/admin/usuarios"
                className="group flex items-center gap-3 rounded-lg border border-amber-700 bg-amber-900/30 p-4 transition-all hover:border-amber-500 hover:bg-amber-900/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-xl group-hover:bg-amber-500">
                  👥
                </div>
                <div>
                  <h3 className="font-semibold">Usuários</h3>
                  <p className="text-xs text-amber-300/70">Gerenciar usuários</p>
                </div>
              </Link>

              <Link
                href="/admin/diagnostico"
                className="group flex items-center gap-3 rounded-lg border border-amber-700 bg-amber-900/30 p-4 transition-all hover:border-amber-500 hover:bg-amber-900/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-xl group-hover:bg-amber-500">
                  🔍
                </div>
                <div>
                  <h3 className="font-semibold">Diagnóstico</h3>
                  <p className="text-xs text-amber-300/70">Ver configurações</p>
                </div>
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
