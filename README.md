# Portal do Contador — Tiny ERP V3

Stack: Next.js 15 (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui, Auth.js (credentials + bcrypt), Prisma + Vercel Postgres, exports CSV/XLSX.

## Setup local
```bash
npm install
npx prisma generate
# configure .env (copie de .env.example)
npm run dev
```

## Variáveis de ambiente (ver .env.example)
- `DATABASE_URL` — string do Vercel Postgres.
- `AUTH_SECRET`, `AUTH_URL` — Auth.js.
- `ENCRYPTION_MASTER_KEY` — 32 bytes base64 (AES-256-GCM para tokens Tiny).
- `TINY_CLIENT_ID`, `TINY_CLIENT_SECRET`, `TINY_REDIRECT_URI`, `TINY_AUTH_BASE`, `TINY_API_BASE`.
- `CRON_SECRET` — Bearer usado pelo Vercel Cron para chamar `/api/admin/sync`.

## Banco e Prisma
- Schema em `prisma/schema.prisma` (tabelas vw_* persistidas, não views).
- Migration SQL gerada em `prisma/migrations/0001_init.sql` (from-empty).
- Gere client: `npx prisma generate`.
- Para aplicar em novo DB: `psql < prisma/migrations/0001_init.sql` (ou `prisma migrate deploy` quando apontar para um Postgres real).

## Fluxo de autenticação / RBAC
- Login por email+senha (Auth.js credentials) em `/login`.
- Papéis: `ADMIN` (admin+sync), `OPERADOR` (sync), `CONTADOR` (leitura/export).
- Middleware restringe `/admin/**`, `/api/admin/**`, `/relatorios/**`, `/api/exports/**`.
- Crie usuários em `/admin/usuarios` (hash bcrypt gerado server-side).

## Conexão Tiny (OAuth2)
- Página `/admin/conexoes-tiny`: criar empresas e conectar via OAuth2.
- Endpoint de início: `POST /api/admin/tiny/start` (gera URL com state assinado).
- Callback: `/api/tiny/callback` salva tokens criptografados (AES-256-GCM) em `TinyConnection`.
- Tokens nunca vão ao frontend; refresh automático em `lib/tiny/client.ts`.

## Sincronização (esqueleto)
- Endpoint protegido: `POST /api/admin/sync` (ADMIN/OPERADOR ou Bearer `CRON_SECRET` para cron).
- Orquestração em `jobs/sync.ts` (hoje como esqueleto/no-op; precisa mapear módulos Tiny → tabelas vw_*).
- Logs em `SyncRun` e `AuditLog`. Snapshots diários previstos para `vw_contas_receber_posicao` e `vw_estoque` (implementar no handler real).

### Vercel Cron
- Configure um cron chamando `POST https://<sua-url>/api/admin/sync` com header `Authorization: Bearer <CRON_SECRET>`.

## Relatórios e export
- Páginas: `/relatorios/[view]` para as 6 views (filtros: período, status, busca, empresa, paginação simples).
- Export: `/api/exports/{view}.csv` e `/api/exports/{view}.xlsx` aplicam os mesmos filtros e registram auditoria `EXPORT`.
- Botão “Sincronizar agora” disponível na página de relatório (dispara `/api/admin/sync` para a empresa selecionada).

## Gaps conhecidos
- Integração Tiny ainda sem mapear endpoints/campos reais; `jobs/sync.ts` contém o esqueleto (preencher fetch + mapping para tabelas vw_* e atualizar cursors/snapshots).
- Campos ausentes no Tiny devem ser derivados ou preenchidos com “N/D” (string) ou 0; documentar o mapa final ao implementar o sync real.

## Deploy na Vercel
- Configure Vercel Postgres e `DATABASE_URL`.
- Defina as variáveis do bloco de ambiente acima.
- `npm run build` para testar local; deploy automático via GitHub.
- Certifique-se de configurar o `TINY_REDIRECT_URI` apontando para o domínio de produção (`/api/tiny/callback`).
- Adicione o cron no painel da Vercel usando `CRON_SECRET`.
