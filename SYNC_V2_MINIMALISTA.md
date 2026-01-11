# 🚀 SYNC V2 MINIMALISTA - IMPLEMENTADO

**Data:** 11/01/2026  
**Objetivo:** Sync em steps curtos (< 8s) compatível com Vercel Hobby

---

## ✅ IMPLEMENTADO

### 1️⃣ **Schema Prisma atualizado**
- ✅ Campos `modules`, `moduleIndex`, `cursor` adicionados ao `SyncRun`
- ✅ Prisma Client regenerado

### 2️⃣ **Endpoints V2 criados**

#### **POST /api/admin/sync/v2/create**
Cria novo SyncRun com status QUEUED
- Input: `{ companyId, startDate?, endDate?, syncMode? }`
- Output: `{ runId, modules, mode }`
- Lógica: Exclui `vw_estoque` se `syncMode="period"`

#### **POST /api/admin/sync/v2/start**
Inicia sync (QUEUED → RUNNING)
- Input: `{ runId }`
- Output: `{ status }`

#### **POST /api/admin/sync/v2/step**
Executa UM chunk/step
- Input: `{ runId }`
- Output: `{ status, currentModule, processed, done, progress, durationMs }`
- Limite: < 8s por step

#### **GET /api/admin/sync/v2/status**
Consulta status do sync
- Input: `?runId=...`
- Output: `{ run: { status, currentModule, progress, ... } }`

### 3️⃣ **Chunk Executor**
- ✅ `processVendasChunk()`: 10 pedidos por step
- ✅ `processContasReceberChunk()`: 1 página por step
- ✅ Outros módulos: estrutura pronta
- ✅ Cache de categorias integrado
- ✅ Zero chamadas `/produtos/{id}` em período

### 4️⃣ **Frontend**
- ✅ `SyncV2Button` component
- ✅ Loop automático de steps
- ✅ Barra de progresso
- ✅ Status em tempo real

---

## 🧪 COMO TESTAR

### 1. **Usar botão V2 temporariamente:**

Em `app/relatorios/[view]/page.tsx`, adicione:

```typescript
import { SyncV2Button } from "@/components/sync-v2-button";

// No JSX:
<SyncV2Button 
  companyId={selectedCompanyId}
  startDate="2025-09-01"
  endDate="2025-09-30"
/>
```

### 2. **Testar fluxo:**

```
1. Clicar "Sincronizar V2"
2. Ver progresso:
   "Criando sync..." → "Iniciando..." → "vw_contas_receber_posicao (20%)" → ...
3. Aguardar "Concluído!"
4. Página recarrega automaticamente
```

### 3. **Verificar logs:**

```
[SyncV2 Create] ✓ SyncRun criado: abc123, mode=period, modules=5
[SyncV2 Start] ✓ SyncRun iniciado: abc123
[SyncV2 Step] Processando módulo vw_contas_receber_posicao (1/5)
[ChunkContasReceber] Processando página 1
[ChunkContasReceber] ✓ 45 itens processados. Página 1/1
[SyncV2 Step] ✓ Step concluído em 2345ms. Progress: 20%
...
[SyncV2 Step] ✓ Sync finalizado: abc123
```

---

## ⚠️ PRÓXIMOS PASSOS

### **Implementar processadores faltantes:**

Os chunks de contas estão com implementação simplificada. Precisa:

1. `processContasPagarChunk()` - implementar transformer completo
2. `processContasPagasChunk()` - implementar transformer completo
3. `processContasRecebidasChunk()` - implementar transformer completo

Use como base o código atual de `syncContasPagar()`, `syncContasPagas()`, etc. em `jobs/sync.ts`.

### **Melhorias opciais:**

1. Modal de progresso mais visual
2. Botão de cancelar
3. Logs no frontend
4. Retry automático em caso de erro

---

## ✅ STATUS

- ✅ Estrutura completa
- ✅ Vendas funcional
- ⚠️ Contas: estrutura pronta, precisa implementar transformers
- ✅ Compatível Vercel Hobby (< 8s por step)
- ✅ Zero enrichment em período
- ✅ Progresso visível

**Pronto para teste com vendas. Contas precisam ser completadas.**
