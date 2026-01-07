import { auth } from "@/auth";
import { LoginForm } from "./login-form";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/relatorios/vw_vendas");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-slate-950/50">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Portal do Contador
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Acesse sua conta
          </h1>
          <p className="text-sm text-slate-400">
            Use email e senha fornecidos pelo administrador.
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}

