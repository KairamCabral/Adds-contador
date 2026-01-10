"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ConfigData = {
  tiny: {
    redirectUri: string;
    authBase: string;
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
  };
  auth: {
    authSecretConfigured: boolean;
  };
  cron: {
    cronSecretConfigured: boolean;
  };
  database: {
    databaseUrlConfigured: boolean;
  };
};

export default function DiagnosticoPage() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => {
        if (!res.ok) throw new Error("Acesso negado");
        return res.json();
      })
      .then(setConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-white">Carregando diagnóstico...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">
            ❌ Erro: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!config) return null;

  const expectedRedirectUri = `${window.location.origin}/api/tiny/callback`;
  const redirectUriMatch = config.tiny.redirectUri === expectedRedirectUri;

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🔍 Diagnóstico do Sistema
            </h1>
            <p className="text-gray-400">
              Verificação de configurações e variáveis de ambiente
            </p>
          </div>
          <Link
            href="/admin/conexoes-tiny"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            ← Voltar
          </Link>
        </div>

        {/* Configuração Tiny OAuth */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            🔑 Configuração Tiny OAuth
          </h2>

          <div className="space-y-4">
            {/* Client ID */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">
                  TINY_CLIENT_ID
                </div>
                <div className="text-xs text-gray-500">
                  ID da aplicação no Tiny ERP
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded text-sm ${
                  config.tiny.clientIdConfigured
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {config.tiny.clientIdConfigured ? "✅ Configurado" : "❌ Ausente"}
              </div>
            </div>

            {/* Client Secret */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">
                  TINY_CLIENT_SECRET
                </div>
                <div className="text-xs text-gray-500">
                  Secret da aplicação no Tiny ERP
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded text-sm ${
                  config.tiny.clientSecretConfigured
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {config.tiny.clientSecretConfigured
                  ? "✅ Configurado"
                  : "❌ Ausente"}
              </div>
            </div>

            {/* Redirect URI */}
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-300">
                    TINY_REDIRECT_URI
                  </div>
                  <div className="text-xs text-gray-500">
                    URL de callback OAuth
                  </div>
                </div>
                <div
                  className={`px-3 py-1 rounded text-sm ${
                    redirectUriMatch
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {redirectUriMatch ? "✅ Correto" : "⚠️ Verificar"}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3 space-y-2">
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Valor configurado:
                  </div>
                  <div className="text-sm text-gray-300 font-mono break-all">
                    {config.tiny.redirectUri}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Valor esperado:
                  </div>
                  <div className="text-sm text-green-400 font-mono break-all">
                    {expectedRedirectUri}
                  </div>
                </div>

                {!redirectUriMatch && (
                  <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                    <div className="text-sm text-yellow-400 mb-2">
                      ⚠️ URL não corresponde ao esperado
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>1. Atualize TINY_REDIRECT_URI na Vercel</p>
                      <p>2. Use exatamente: {expectedRedirectUri}</p>
                      <p>3. Faça Redeploy após alterar</p>
                      <p>
                        4. Registre esta URL no painel do Tiny ERP
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Auth Base */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">
                  TINY_AUTH_BASE
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {config.tiny.authBase}
                </div>
              </div>
              <div className="px-3 py-1 rounded text-sm bg-blue-500/20 text-blue-400">
                ℹ️ Info
              </div>
            </div>
          </div>
        </div>

        {/* Outras Configurações */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            ⚙️ Outras Configurações
          </h2>

          <div className="space-y-4">
            {/* AUTH_SECRET */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">
                  AUTH_SECRET
                </div>
                <div className="text-xs text-gray-500">
                  Chave para autenticação NextAuth
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded text-sm ${
                  config.auth.authSecretConfigured
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {config.auth.authSecretConfigured
                  ? "✅ Configurado"
                  : "❌ Ausente"}
              </div>
            </div>

            {/* CRON_SECRET */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">
                  CRON_SECRET
                </div>
                <div className="text-xs text-gray-500">
                  Chave para sincronização automática (cron)
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded text-sm ${
                  config.cron.cronSecretConfigured
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {config.cron.cronSecretConfigured
                  ? "✅ Configurado"
                  : "❌ Ausente"}
              </div>
            </div>

            {/* DATABASE_URL */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">
                  DATABASE_URL
                </div>
                <div className="text-xs text-gray-500">
                  Conexão com banco de dados
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded text-sm ${
                  config.database.databaseUrlConfigured
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {config.database.databaseUrlConfigured
                  ? "✅ Configurado"
                  : "❌ Ausente"}
              </div>
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">
            📖 Como Corrigir Problemas
          </h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p>
              <strong>1. Erro &quot;Invalid parameter: redirect_uri&quot;:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-gray-400">
              <li>Copie o &quot;Valor esperado&quot; acima</li>
              <li>
                Acesse o painel do Tiny ERP e adicione esta URL em &quot;Redirect
                URIs&quot;
              </li>
              <li>Atualize TINY_REDIRECT_URI na Vercel com o mesmo valor</li>
              <li>Faça Redeploy se alterou na Vercel</li>
            </ul>

            <p className="mt-4">
              <strong>2. Variáveis ausentes:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-gray-400">
              <li>Acesse Vercel → Settings → Environment Variables</li>
              <li>Adicione as variáveis faltantes</li>
              <li>Faça Redeploy para aplicar</li>
            </ul>

            <p className="mt-4">
              <strong>3. Documentação completa:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-gray-400">
              <li>
                Consulte <code>CORRIGIR_ERRO_REDIRECT_URI.md</code>
              </li>
              <li>
                Siga o passo-a-passo do <code>INSTRUCOES_OAUTH.md</code>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          Esta página é visível apenas para administradores
        </div>
      </div>
    </div>
  );
}
