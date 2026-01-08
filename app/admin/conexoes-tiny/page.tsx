import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

import { ConnectTinyButton } from "./connect-button";

async function createCompany(formData: FormData) {
  "use server";
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN])) {
    throw new Error("Acesso negado");
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    throw new Error("Nome é obrigatório");
  }

  await prisma.company.create({
    data: { name },
  });

  revalidatePath("/admin/conexoes-tiny");
}

export default async function ConexoesTinyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!userHasRole(session, [Role.ADMIN])) redirect("/login");

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      connections: true,
      syncRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Admin
            </p>
            <h1 className="text-2xl font-semibold">Conexões Tiny</h1>
            <p className="text-sm text-slate-400">
              Conecte empresas via OAuth2 para sincronizar dados.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold text-slate-100">Nova empresa</h2>
          <form action={createCompany} className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              name="name"
              placeholder="Nome da empresa"
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Criar
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Empresa</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Último sync</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {companies.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                      Nenhuma empresa cadastrada.
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => {
                    const connection = company.connections[0];
                    const lastSync = company.syncRuns[0];
                    return (
                      <tr key={company.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium">{company.name}</td>
                        <td className="px-4 py-3">
                          {connection ? (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">
                              Conectado
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-200">
                              Não conectado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {lastSync
                            ? `${lastSync.status} em ${new Date(
                                lastSync.startedAt,
                              ).toLocaleString("pt-BR")}`
                            : "Nunca sincronizado"}
                        </td>
                        <td className="px-4 py-3">
                          <ConnectTinyButton companyId={company.id} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

