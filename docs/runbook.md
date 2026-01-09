# Runbook - Portal do Contador

Guia operacional para implantação, configuração e troubleshooting do sistema.

---

## 🚀 Deploy e Configuração Inicial

### 1. Variáveis de Ambiente Obrigatórias

```env
# Banco de Dados
DATABASE_URL=postgresql://user:pass@host:5432/db

# Autenticação (NextAuth)
AUTH_SECRET=<gerado com: openssl rand -base64 32>
AUTH_URL=https://seu-dominio.com (produção) ou http://localhost:3000 (local)

# Criptografia de Tokens Tiny
ENCRYPTION_MASTER_KEY=<gerado com: openssl rand -base64 32>

# API Tiny V3 (OAuth)
TINY_CLIENT_ID=<obtido no painel Tiny ERP>
TINY_CLIENT_SECRET=<obtido no painel Tiny ERP>
TINY_REDIRECT_URI=https://seu-dominio.com/api/tiny/callback (ou http://localhost:3000/api/tiny/callback para local)
TINY_API_BASE=https://erp.tiny.com.br/public-api/v3
TINY_AUTH_BASE=https://accounts.tiny.com.br

# Cron (sync automático)
CRON_SECRET=<gerado com: openssl rand -base64 32>

# Sync (opcional)
SYNC_LOOKBACK_DAYS=90
```

### 2. Setup Inicial do Banco

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npx prisma generate

# Aplicar migrations
npx prisma migrate deploy

# (Opcional) Seed inicial
npx prisma db seed
```

### 3. Criar Primeiro Usuário Admin

```sql
-- No Postgres, executar:
INSERT INTO "User" (id, email, "passwordHash", name, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@adds.com.br',
  '<hash bcrypt da senha Admin@123>',
  'Admin ADDS',
  NOW(),
  NOW()
);

-- Vincular à empresa ADDS
INSERT INTO "CompanyMember" (id, "companyId", "userId", role, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  c.id,
  u.id,
  'ADMIN',
  NOW(),
  NOW()
FROM "Company" c, "User" u
WHERE c.name = 'ADDS Brasil' AND u.email = 'admin@adds.com.br';
```

> **Dica**: Para gerar o hash bcrypt da senha, use:
> ```bash
> node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Admin@123', 10));"
> ```

---

## 🔗 Conectar Tiny ERP (OAuth)

### Passo 1: Registrar Aplicação no Painel Tiny

1. Acesse: https://erp.tiny.com.br/
2. Vá em: **Configurações → Integrações → API → Novo Aplicativo**
3. Preencha:
   - **Nome**: "Portal do Contador"
   - **URL de Redirecionamento**: `https://seu-dominio.com/api/tiny/callback`  
     (ou `http://localhost:3000/api/tiny/callback` para testes locais)
4. Copie o **Client ID** e **Client Secret** gerados
5. Atualize o `.env` com essas credenciais

### Passo 2: Conectar no Sistema

1. Faça login no Portal como **ADMIN**
2. Acesse: **`/admin/conexoes-tiny`**
3. Clique em **"Conectar Tiny"** na linha da empresa "ADDS Brasil"
4. Será redirecionado para o Tiny (Keycloak/Olist)
5. Faça login e autorize
6. Será redirecionado de volta com mensagem **"Conectado"**
7. A `TinyConnection` estará salva no banco (tokens criptografados)

### Passo 3: Verificar Conexão (Smoke Test)

```bash
# Fazer request (substituir TOKEN pelo JWT de admin):
curl -X GET "https://seu-dominio.com/api/admin/tiny/smoke?companyId=<UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

**Resposta esperada**:
```json
{
  "pedidos": { "status": "OK", "count": 100, "timeMs": 450 },
  "contasReceber": { "status": "OK", "count": 50, "timeMs": 320 },
  "contasPagar": { "status": "OK", "count": 30, "timeMs": 280 }
}
```

Se algum retornar `"status": "FAILED"`, verificar logs do servidor.

---

## 🔄 Sincronização de Dados

### Sync Manual (via UI)

1. Acesse qualquer relatório (ex.: `/relatorios/vw_vendas`)
2. Clique em **"Sincronizar agora"**
3. Aguarde conclusão (pode levar 30-60 segundos na primeira vez)
4. Status aparecerá como **"Último sync: OK em DD/MM/AAAA HH:MM"**

### Sync Manual (via API)

```bash
curl -X POST "https://seu-dominio.com/api/admin/sync" \
  -H "Content-Type: application/json" \
  -d '{"companyId": "<UUID>"}'
```

### Sync Automático (Cron - Vercel)

No arquivo `vercel.json` (raiz do projeto):

```json
{
  "crons": [
    {
      "path": "/api/admin/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Isso roda o sync **diariamente às 6h UTC** (3h da manhã no horário de Brasília).

**Autenticação do Cron**:
O endpoint `/api/admin/sync` aceita header `Authorization: Bearer <CRON_SECRET>` (variável de ambiente).

---

## 🐛 Troubleshooting

### Problema: "TinyConnection não encontrada"

**Causa**: Empresa não conectada ao Tiny via OAuth.

**Solução**:
1. Acesse `/admin/conexoes-tiny`
2. Clique em **"Conectar Tiny"**
3. Complete o fluxo OAuth

### Problema: Sync falha com "401 Unauthorized"

**Causa**: Access token expirado e refresh token inválido.

**Solução**:
1. Reconectar Tiny (refazer OAuth)
2. Verificar no painel Tiny se o app ainda está autorizado

### Problema: Sync falha com "429 Too Many Requests"

**Causa**: Rate limit da API Tiny (muitas requests simultâneas).

**Solução**:
- O sistema já tem retry automático com backoff exponencial
- Aguardar 1-2 minutos e tentar novamente
- Se persistir, verificar logs para saber qual endpoint está sendo chamado em excesso

### Problema: Dados não aparecem após sync OK

**Causa**: Possíveis:
1. Filtro de período muito restrito
2. Dados realmente não existem no Tiny
3. Transformer com erro silencioso

**Diagnóstico**:
```sql
-- Verificar se RawPayload foi salvo:
SELECT resource, COUNT(*) 
FROM "RawPayload" 
WHERE "companyId" = '<UUID>' 
GROUP BY resource;

-- Verificar se vw_* foi populado:
SELECT COUNT(*) FROM "VwVendas" WHERE "companyId" = '<UUID>';
SELECT COUNT(*) FROM "VwContasReceberPosicao" WHERE "companyId" = '<UUID>';
SELECT COUNT(*) FROM "VwContasPagar" WHERE "companyId" = '<UUID>';
```

Se `RawPayload` tem dados mas `vw_*` não, problema está no transformer.

### Problema: "Invalid parameter: redirect_uri"

**Causa**: O `redirect_uri` no `.env` não corresponde ao registrado no painel Tiny.

**Solução**:
1. Verificar no painel Tiny qual URI está cadastrado
2. Atualizar `TINY_REDIRECT_URI` no `.env` para ser **exatamente igual**
3. Reiniciar servidor Next.js

### Problema: Sync demora muito (> 5 minutos)

**Causa**: Muitos pedidos/contas para processar (primeira sincronização).

**Mitigação**:
- Reduzir `SYNC_LOOKBACK_DAYS` (padrão 90, tentar 30)
- Verificar logs para ver quantos registros estão sendo processados
- Rate limit da Tiny pode estar limitando velocidade (retry automático aumenta tempo total)

**Logs úteis**:
```bash
# Verificar último SyncRun:
SELECT * FROM "SyncRun" 
WHERE "companyId" = '<UUID>' 
ORDER BY "startedAt" DESC 
LIMIT 1;

# Ver estatísticas:
SELECT "statsJson" FROM "SyncRun" WHERE status = 'OK' LIMIT 1;
```

---

## 📊 Queries Úteis

### Listar Todas as Empresas e Conexões

```sql
SELECT 
  c.name AS empresa,
  tc.id IS NOT NULL AS conectado,
  tc."connectedAt" AS conectado_em,
  (SELECT COUNT(*) FROM "SyncRun" sr WHERE sr."companyId" = c.id) AS total_syncs
FROM "Company" c
LEFT JOIN "TinyConnection" tc ON tc."companyId" = c.id;
```

### Ver Último Sync por Empresa

```sql
SELECT 
  c.name AS empresa,
  sr.status,
  sr."startedAt",
  sr."finishedAt",
  sr."errorMessage",
  sr."statsJson"
FROM "Company" c
LEFT JOIN LATERAL (
  SELECT * FROM "SyncRun" 
  WHERE "companyId" = c.id 
  ORDER BY "startedAt" DESC 
  LIMIT 1
) sr ON true;
```

### Contagem de Registros por View

```sql
SELECT 
  'vw_vendas' AS view, COUNT(*) AS total 
FROM "VwVendas" WHERE "companyId" = '<UUID>'
UNION ALL
SELECT 
  'vw_contas_receber', COUNT(*) 
FROM "VwContasReceberPosicao" WHERE "companyId" = '<UUID>'
UNION ALL
SELECT 
  'vw_contas_pagar', COUNT(*) 
FROM "VwContasPagar" WHERE "companyId" = '<UUID>';
```

### Ver Auditoria de Exports

```sql
SELECT 
  al."createdAt",
  u.email AS usuario,
  al.action,
  al.metadata->>'view' AS view,
  al.metadata->>'filters' AS filtros
FROM "AuditLog" al
JOIN "User" u ON u.id = al."actorUserId"
WHERE al.action = 'EXPORT'
ORDER BY al."createdAt" DESC
LIMIT 20;
```

---

## 🔒 Segurança e Manutenção

### Rotação de Secrets

**Periodicidade recomendada**: A cada 6 meses

1. **AUTH_SECRET**:
   ```bash
   openssl rand -base64 32
   ```
   - Atualizar no `.env` e Vercel
   - Reiniciar servidor
   - Usuários precisarão fazer login novamente

2. **ENCRYPTION_MASTER_KEY**:
   - ⚠️ **Cuidado!** Trocar essa chave invalida todos os tokens Tiny criptografados
   - Estratégia: Migrar chave antiga → nova com script de re-criptografia
   - Ou: Reconectar todas as empresas no Tiny (perda de conexão)

3. **CRON_SECRET**:
   ```bash
   openssl rand -base64 32
   ```
   - Atualizar no `.env` e Vercel
   - Atualizar em `vercel.json` se configurado lá

### Backup

**O que fazer backup**:
- Banco de dados completo (Postgres dump)
- Variáveis de ambiente (sem expor secrets publicamente)

**Periodicidade**:
- Diário (automático via serviço de DB)
- Antes de migrations críticas

---

## 📞 Suporte

**Documentação Técnica**:
- `docs/field-mapping.md` → Mapeamento de campos
- `README.md` → Instruções de desenvolvimento

**Logs do Sistema**:
- Vercel: https://vercel.com/seu-projeto/logs
- Banco: Verificar `AuditLog` e `SyncRun`

**Contatos**:
- Tech Lead: [contato]
- Suporte Tiny ERP: https://ajuda.tiny.com.br/

---

**Última Atualização**: 2026-01-08  
**Versão**: 1.0.0

