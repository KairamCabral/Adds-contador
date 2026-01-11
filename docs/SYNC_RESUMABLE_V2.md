# Sync Resumable V2 - Documentação Completa

## 📋 Visão Geral

Sistema de sincronização com **progresso visível** e **execução resiliente**, que resolve os problemas de timeout e falta de feedback visual do sync anterior.

### Problemas Resolvidos

**ANTES (V1):**
- ❌ Request longa (até 13 minutos) que pode abortar/timeout
- ❌ Sem feedback visual durante execução
- ❌ Se falhar, não há registro do que foi processado
- ❌ Impossível cancelar sync em andamento
- ❌ Não funciona bem em serverless (Vercel timeout 300s)

**DEPOIS (V2):**
- ✅ Request retorna imediatamente com `runId`
- ✅ Progresso visível em tempo real (modal com status por módulo)
- ✅ Estado persistido no banco (resumable)
- ✅ Cancelamento durante execução
- ✅ Funciona perfeitamente em serverless (passos pequenos)
- ✅ Histórico completo de execuções e logs

---

## 🏗️ Arquitetura

### 1. **Banco de Dados (Prisma)**

#### `SyncRun`
Registro de cada execução de sincronização:

```prisma
model SyncRun {
  id                String        @id @default(uuid())
  companyId         String
  mode              String        // "incremental" | "period"
  startDate         DateTime?
  endDate           DateTime?
  status            SyncStatus    // QUEUED | RUNNING | DONE | FAILED | CANCELED
  currentModule     String?
  progressJson      Json?         // { modules: { [key]: { status, processed, errors } } }
  errorMessage      String?
  createdAt         DateTime      @default(now())
  startedAt         DateTime?
  finishedAt        DateTime?
  triggeredByUserId String?
  logs              SyncRunLog[]
}
```

#### `SyncRunLog`
Logs detalhados de cada execução:

```prisma
model SyncRunLog {
  id        String   @id @default(uuid())
  runId     String
  timestamp DateTime @default(now())
  level     String   // "info" | "warn" | "error"
  message   String
  module    String?
  metadata  Json?
  run       SyncRun  @relation(...)
}
```

### 2. **Executor Resumable** (`lib/sync/executor.ts`)

Funções principais:

- **`createSyncRun()`** - Cria novo registro com status QUEUED
- **`startSyncRun()`** - Muda status para RUNNING
- **`runSyncStep()`** - Executa UM módulo por vez
- **`cancelSyncRun()`** - Cancela execução
- **`getSyncRunStatus()`** - Retorna status + logs

**Fluxo de Execução:**

```
1. createSyncRun() → SyncRun(status=QUEUED)
2. startSyncRun() → SyncRun(status=RUNNING)
3. Loop:
   - runSyncStep() → executa 1 módulo
   - atualiza progressJson
   - retorna hasMore=true/false
4. Quando hasMore=false → SyncRun(status=DONE)
```

### 3. **Rotas API**

#### `POST /api/admin/sync/v2/create`
Cria um novo SyncRun e retorna `runId` imediatamente.

**Request:**
```json
{
  "companyId": "xxx",
  "mode": "period",
  "month": "2024-12"
}
```

**Response:**
```json
{
  "success": true,
  "runId": "uuid",
  "status": "QUEUED"
}
```

#### `POST /api/admin/sync/v2/start`
Inicia a execução (QUEUED → RUNNING).

**Request:**
```json
{
  "runId": "uuid"
}
```

#### `POST /api/admin/sync/v2/step`
Executa UM PASSO (um módulo).

**Request:**
```json
{
  "runId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "runId": "uuid",
  "status": "RUNNING",
  "currentModule": "vw_vendas",
  "progress": {
    "modules": {
      "vw_vendas": { "status": "running", "processed": 0 },
      "vw_contas_pagar": { "status": "pending", "processed": 0 }
    }
  },
  "hasMore": true
}
```

#### `GET /api/admin/sync/v2/status?runId=xxx`
Retorna status atual + logs recentes.

#### `POST /api/admin/sync/v2/cancel`
Cancela execução em andamento.

### 4. **UI Components**

#### `SyncControlsV2`
Controles de sincronização com seletor de modo:

- Rápido (30 dias)
- Por Mês (seletor de mês)

Ao clicar "Sincronizar":
1. Chama `/api/admin/sync/v2/create`
2. Recebe `runId`
3. Abre `SyncProgressModal`

#### `SyncProgressModal`
Modal com progresso em tempo real:

**Características:**
- Lista de módulos com status (pending/running/done/failed)
- Ícones visuais (spinner, check, erro)
- Contador de registros processados
- Logs recentes em tempo real
- Botão "Cancelar" (enquanto rodando)
- Botão "Fechar" (quando concluído)

**Lógica:**
1. Ao abrir: chama `/start` para iniciar
2. Loop: chama `/step` a cada 1-2s
3. Polling: chama `/status` a cada 2s para atualizar UI
4. Quando `hasMore=false`: para loop e mostra "Concluído"

---

## 🔄 Fluxo Completo

### Fluxo do Usuário

```
1. Usuário clica "Sincronizar" (modo Rápido ou Por Mês)
   ↓
2. POST /api/admin/sync/v2/create
   → retorna runId imediatamente
   ↓
3. Modal abre mostrando "Preparando..."
   ↓
4. Modal chama POST /api/admin/sync/v2/start
   → status muda para RUNNING
   ↓
5. Loop de execução:
   a) Modal chama POST /api/admin/sync/v2/step
   b) Backend executa 1 módulo (ex: vw_vendas)
   c) Atualiza progressJson no banco
   d) Retorna hasMore=true
   e) Modal atualiza UI (spinner no módulo atual)
   f) Aguarda 1s e repete
   ↓
6. Quando todos os módulos concluem:
   → hasMore=false
   → status=DONE
   → Modal mostra "Concluída com sucesso!"
   ↓
7. Usuário clica "Fechar"
   → Página recarrega com novos dados
```

### Fluxo Técnico (Backend)

```typescript
// 1. Criar
const run = await createSyncRun({
  companyId: "xxx",
  mode: "period",
  startDate: new Date("2024-12-01"),
  endDate: new Date("2024-12-31"),
});
// run.status = "QUEUED"
// run.progressJson = { modules: { vw_vendas: { status: "pending", ... }, ... } }

// 2. Iniciar
await startSyncRun(run.id);
// run.status = "RUNNING"
// run.startedAt = now()

// 3. Executar passos
let hasMore = true;
while (hasMore) {
  hasMore = await runSyncStep(run.id);
  // Cada passo:
  // - Encontra próximo módulo pendente
  // - Executa syncVendas() ou syncContasPagar() etc
  // - Atualiza progressJson
  // - Retorna true se ainda há módulos pendentes
}

// 4. Finalizar
// Quando hasMore=false, runSyncStep() automaticamente:
// - Atualiza status para DONE
// - Define finishedAt
```

---

## 📊 Progresso JSON (Estrutura)

```json
{
  "modules": {
    "vw_vendas": {
      "status": "done",
      "processed": 150,
      "skipped": 5,
      "errors": []
    },
    "vw_contas_receber_posicao": {
      "status": "done",
      "processed": 25,
      "errors": []
    },
    "vw_contas_pagar": {
      "status": "running",
      "processed": 0
    },
    "vw_contas_pagas": {
      "status": "pending",
      "processed": 0
    },
    "vw_contas_recebidas": {
      "status": "pending",
      "processed": 0
    },
    "vw_estoque": {
      "status": "pending",
      "processed": 0
    }
  }
}
```

**Status possíveis:**
- `pending` - Aguardando execução
- `running` - Em execução
- `done` - Concluído com sucesso
- `failed` - Falhou (mas outros módulos continuam)

---

## 🎯 Vantagens do Sync V2

### 1. **Resiliente a Timeouts**
- Cada passo é uma request curta (< 5min)
- Funciona perfeitamente em Vercel (300s timeout)
- Se uma request falhar, próxima continua de onde parou

### 2. **Feedback Visual**
- Usuário vê exatamente o que está acontecendo
- Progresso por módulo (spinner, check, erro)
- Logs em tempo real
- Contador de registros processados

### 3. **Cancelável**
- Botão "Cancelar" durante execução
- Executor respeita flag de cancelamento
- Módulos já processados permanecem no banco

### 4. **Histórico Completo**
- Todas as execuções ficam registradas
- Logs detalhados por módulo
- Possível auditar o que foi sincronizado e quando

### 5. **Graceful Degradation**
- Se um módulo falha, outros continuam
- Erro fica registrado no progressJson
- Status final mostra quais módulos falharam

### 6. **Compatível com Serverless**
- Não depende de threads/workers em background
- Cada step é stateless (estado no banco)
- Funciona em qualquer plataforma (Vercel, AWS Lambda, etc)

---

## 🧪 Como Testar

### 1. **Teste Local**

```bash
# 1. Aplicar migrations
npx prisma db push

# 2. Gerar client
npx prisma generate

# 3. Rodar dev server
npm run dev

# 4. Abrir http://localhost:3000/relatorios
# 5. Clicar em "Sincronizar"
# 6. Observar modal com progresso
```

### 2. **Teste de Cancelamento**

1. Iniciar sincronização
2. Aguardar 1-2 módulos concluírem
3. Clicar "Cancelar"
4. Verificar que status mudou para "CANCELED"
5. Verificar no banco que módulos já processados permanecem

### 3. **Teste de Erro**

1. Simular erro (ex: desconectar internet temporariamente)
2. Observar que módulo falha mas outros continuam
3. Verificar que erro aparece no modal
4. Verificar logs no banco

### 4. **Teste de Histórico**

```sql
-- Ver todas as execuções
SELECT id, mode, status, "createdAt", "finishedAt"
FROM "SyncRun"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Ver logs de uma execução
SELECT timestamp, level, message, module
FROM "SyncRunLog"
WHERE "runId" = 'xxx'
ORDER BY timestamp DESC;
```

---

## 🔧 Configuração

### Variáveis de Ambiente

Nenhuma nova variável necessária. Usa as mesmas do cache inteligente:

```bash
# Rate Limiter (opcional)
TINY_MIN_INTERVAL=1000
TINY_CONCURRENCY=1
TINY_MAX_RETRIES=2

# Enrichment (opcional)
TINY_MAX_ENRICH_PER_RUN=50

# Cron (obrigatório)
CRON_SECRET=seu-secret
```

### Uso na UI

**Opção 1: Substituir componente antigo**

```tsx
// app/relatorios/page.tsx
import { SyncControlsV2 } from "@/components/sync-controls-v2";

// ...
<SyncControlsV2 companyId={companyId} lastSync={lastSync} />
```

**Opção 2: Manter ambos (transição gradual)**

```tsx
import { SyncControls } from "@/components/sync-controls"; // V1
import { SyncControlsV2 } from "@/components/sync-controls-v2"; // V2

// Usar V2 por padrão, V1 como fallback
const useV2 = true;

{useV2 ? (
  <SyncControlsV2 companyId={companyId} lastSync={lastSync} />
) : (
  <SyncControls companyId={companyId} lastSync={lastSync} />
)}
```

---

## 📚 Arquivos Criados/Modificados

**Novos:**
- ✅ `prisma/migrations/0003_add_sync_progress_tracking.sql`
- ✅ `lib/sync/executor.ts` - Executor resumable
- ✅ `app/api/admin/sync/v2/create/route.ts`
- ✅ `app/api/admin/sync/v2/start/route.ts`
- ✅ `app/api/admin/sync/v2/step/route.ts`
- ✅ `app/api/admin/sync/v2/status/route.ts`
- ✅ `app/api/admin/sync/v2/cancel/route.ts`
- ✅ `components/sync-progress-modal.tsx`
- ✅ `components/sync-controls-v2.tsx`
- ✅ `docs/SYNC_RESUMABLE_V2.md`

**Modificados:**
- ✅ `prisma/schema.prisma` - Atualizado SyncRun e adicionado SyncRunLog
- ✅ `jobs/sync.ts` - Exportado funções de sync por módulo

---

## 🎉 Resumo

**Sistema de sync resumable implementado com sucesso!**

- ✅ **Progresso visível** em tempo real
- ✅ **Resiliente a timeouts** (passos pequenos)
- ✅ **Cancelável** durante execução
- ✅ **Histórico completo** no banco
- ✅ **Graceful degradation** (erros não bloqueiam)
- ✅ **Compatível com serverless** (Vercel, AWS Lambda)

**Próximos Passos:**
1. Testar localmente
2. Aplicar migrations no banco de produção
3. Substituir `SyncControls` por `SyncControlsV2` na UI
4. Monitorar execuções em produção
5. Ajustar timeouts/limites conforme necessário

---

**Pronto para usar! 🚀**
