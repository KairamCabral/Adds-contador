import { auth } from "@/auth";
import { LoginForm } from "./login-form";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/relatorios/vw_vendas");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src="/Logo-cor-adds.webp" 
            alt="ADDS" 
            className="h-24 w-auto"
          />
        </div>

        {/* Card de Login */}
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="space-y-2 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
              Portal do Contador
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Acesse sua conta
            </h1>
            <p className="text-sm text-slate-600">
              Use email e senha fornecidos pelo administrador.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}

