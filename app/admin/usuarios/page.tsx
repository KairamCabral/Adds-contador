import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";

import { auth } from "@/auth";
import { userHasRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function createUser(formData: FormData) {
  "use server";
  const session = await auth();
  if (!userHasRole(session, [Role.ADMIN])) {
    throw new Error("Acesso negado");
  }

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const name = (formData.get("name") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";
  const companyId = formData.get("companyId") as string;
  const role = formData.get("role") as Role;

  if (!email || !password || !companyId || !role) {
    throw new Error("Campos obrigatórios ausentes");
  }

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, active: true },
    create: { email, name, passwordHash, active: true },
  });

  await prisma.userCompanyRole.upsert({
    where: {
      userId_companyId: {
        userId: user.id,
        companyId,
      },
    },
    update: { role },
    create: { userId: user.id, companyId, role },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      companyId,
      action: "LOGIN",
      metadata: { createdUser: email, role },
    },
  });

  revalidatePath("/admin/usuarios");
}

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!userHasRole(session, [Role.ADMIN])) redirect("/login");

  const [users, companies] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        roles: {
          include: { company: true },
        },
      },
    }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Admin
            </p>
            <h1 className="text-2xl font-semibold">Usuários</h1>
            <p className="text-sm text-slate-400">
              Gerencie contas e papéis de acesso.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold text-slate-100">Novo usuário</h2>
          <form action={createUser} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
            <input
              name="name"
              placeholder="Nome"
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
            />
            <input
              name="email"
              type="email"
              placeholder="email@empresa.com"
              required
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
            />
            <input
              name="password"
              type="password"
              placeholder="Senha"
              required
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
            />
            <select
              name="companyId"
              required
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              defaultValue={companies[0]?.id}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <select
              name="role"
              required
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
            >
              <option value={Role.ADMIN}>ADMIN</option>
              <option value={Role.CONTADOR}>CONTADOR</option>
              <option value={Role.OPERADOR}>OPERADOR</option>
            </select>
            <div className="md:col-span-5">
              <button
                type="submit"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              >
                Salvar usuário
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Papéis</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                      Nenhum usuário cadastrado.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium">{user.name ?? "—"}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">
                        <ul className="space-y-1 text-xs text-slate-200">
                          {user.roles.map((role) => (
                            <li key={role.id} className="flex items-center gap-2">
                              <span className="rounded bg-slate-800 px-2 py-1 font-semibold">
                                {role.role}
                              </span>
                              <span className="text-slate-400">{role.company.name}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3">
                        {user.active ? (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">
                            Ativo
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-200">
                            Inativo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

