# 🚨 DIAGNÓSTICO: Sincronização Automática Não Executou

**Data**: 10/01/2026  
**Status**: 🔴 **PROBLEMA CRÍTICO IDENTIFICADO**

---

## 🔍 PROBLEMA ENCONTRADO

### **Conexão Tiny Expirada ou Inválida**

O script de diagnóstico identificou que:

```
✅ CRON_SECRET está configurada
❌ Nenhuma empresa tem conexão Tiny VÁLIDA
```

**Isso significa que:**
- O cron job da Vercel provavelmente está configurado e rodando
- MAS não consegue sincronizar porque não há conexões válidas com o Tiny ERP
- As conexões OAuth expiram após um período (geralmente 90 dias)

---

## 🛠️ SOLUÇÃO IMEDIATA

### **Passo 1: Reconectar ao Tiny ERP**

1. **Acessar painel de conexões:**
   ```
   https://adds-contador.vercel.app/admin/conexoes-tiny
   ```

2. **Desconectar conexão expirada:**
   - Clique no botão "Desconectar" para a empresa existente

3. **Criar nova conexão:**
   - Clique em "Conectar ao Tiny"
   - Será redirecionado para o Tiny ERP
   - Autorize o acesso
   - Você será redirecionado de volta

4. **Verificar status:**
   - Após reconectar, verifique se aparece:
     - ✅ Status: Conectado
     - Data de expiração: [data futura]

---

### **Passo 2: Testar Sincronização Manual**

Após reconectar, teste imediatamente:

1. Acesse qualquer relatório:
   ```
   https://adds-contador.vercel.app/relatorios/vw_contas_receber_posicao
   ```

2. Clique em "Sincronizar Agora"

3. Aguarde 2-3 minutos

4. Verifique se os dados aparecem

---

### **Passo 3: Aguardar Próximo Cron (Opcional)**

Se não quiser esperar até amanhã às 3h:

**Forçar execução do cron agora:**

```bash
curl -X POST https://adds-contador.vercel.app/api/admin/sync \
  -H "Authorization: Bearer SEU_CRON_SECRET" \
  -H "Content-Type: application/json"
```

(Substitua `SEU_CRON_SECRET` pelo valor da variável de ambiente)

---

## 📋 VERIFICAÇÕES ADICIONAIS

### **1. Verificar Cron Job no Painel Vercel**

1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `adds-contador`
3. Vá em **Settings > Cron Jobs**
4. Verifique:
   - ✅ Path: `/api/admin/sync`
   - ✅ Schedule: `0 3 * * *` (3h da manhã UTC-3)
   - ✅ Status: **Enabled**

Se não estiver habilitado:
- Clique em "Enable"
- Aguarde o próximo dia às 3h para testar

---

### **2. Verificar Logs de Execução**

Para ver se o cron tentou executar:

1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto
3. Vá em **Deployments > Logs**
4. Procure por:
   ```
   [Sync] Iniciando sincronização...
   [Sync] EMPRESA_NOME: Sem conexão Tiny, pulando...
   ```

Se aparecer "Sem conexão Tiny" → confirma que o problema é a conexão expirada.

---

### **3. Verificar no Banco de Dados (Opcional)**

Se tiver acesso ao banco:

```sql
-- Ver últimas sincronizações
SELECT 
  sr."startedAt",
  sr.status,
  sr."errorMessage",
  c.name as empresa
FROM "SyncRun" sr
JOIN "Company" c ON c.id = sr."companyId"
ORDER BY sr."startedAt" DESC
LIMIT 10;

-- Ver conexões Tiny
SELECT 
  c.name as empresa,
  tc."expiresAt",
  CASE 
    WHEN tc."expiresAt" > NOW() THEN 'Válida'
    ELSE 'Expirada'
  END as status
FROM "TinyConnection" tc
JOIN "Company" c ON c.id = tc."companyId";
```

---

## 🔄 COMO FUNCIONA O CRON

### **Fluxo Normal:**

```
1. Vercel Cron dispara às 3h (horário configurado)
2. Chama: POST /api/admin/sync
3. Header: Authorization: Bearer CRON_SECRET
4. Sistema busca todas as empresas com conexão Tiny válida
5. Para cada empresa:
   - Sincroniza últimos 30 dias
   - Atualiza tabelas vw_*
6. Registra em SyncRun o resultado
```

### **O que estava acontecendo:**

```
1. Vercel Cron dispara às 3h ✅
2. Chama: POST /api/admin/sync ✅
3. Sistema busca empresas ✅
4. Verifica conexões → TODAS EXPIRADAS ❌
5. Nada é sincronizado ❌
6. SyncRun registra: "Sem conexão Tiny" ❌
```

---

## 🎯 PREVENÇÃO FUTURA

### **Configurar Alerta de Expiração**

**Opção 1: Monitoramento Manual**
- Verificar validade da conexão a cada 60 dias
- Renovar antes de expirar

**Opção 2: Alerta Automático (Recomendado)**

Criar um endpoint que verifica conexões próximas de expirar e envia alerta:

```
GET /api/admin/check-connections
```

Configurar outro cron para chamar semanalmente e alertar se:
- Conexão expira em < 15 dias

---

## 📊 RESUMO DO DIAGNÓSTICO

| Item | Status | Ação Necessária |
|------|--------|-----------------|
| **CRON_SECRET** | ✅ Configurada | Nenhuma |
| **Cron Job Vercel** | ⚠️ Verificar manualmente | Confirmar se está Enabled |
| **Conexão Tiny** | ❌ **EXPIRADA** | **RECONECTAR URGENTE** |
| **Dados Sincronizados** | ❌ Desatualizados | Após reconectar, sincronizar |

---

## 🚀 AÇÕES IMEDIATAS (PRIORIDADE)

### **✅ Faça AGORA:**

1. **[CRÍTICO]** Reconectar ao Tiny em `/admin/conexoes-tiny`
2. **[CRÍTICO]** Testar sincronização manual
3. **[IMPORTANTE]** Verificar se cron está habilitado no painel Vercel

### **📅 Faça HOJE:**

4. Verificar logs da última tentativa de sincronização
5. Anotar data de expiração da nova conexão
6. Configurar lembrete para renovar antes de expirar

### **🔜 Faça ESTA SEMANA:**

7. Implementar endpoint de monitoramento de conexões
8. Configurar alerta de expiração
9. Documentar procedimento de renovação

---

## 📝 NOTAS TÉCNICAS

### **Por que a conexão expira?**

OAuth 2.0 do Tiny ERP usa **refresh tokens** com validade limitada:
- Access Token: expira em ~1 hora
- Refresh Token: expira em ~90 dias

Após 90 dias sem renovar, é necessário reconectar manualmente.

### **O cron rodou mas não fez nada?**

Provavelmente **SIM**. O código em `jobs/sync.ts` tem este comportamento:

```typescript
// Linha ~1215
if (!connection) {
  console.log(`[Sync] ${company.name}: Sem conexão Tiny, pulando...`);
  await finishRun(run.id, SyncStatus.FAILED, [], 
    "TinyConnection não encontrada..."
  );
  continue; // Pula para próxima empresa
}
```

Então o cron:
- ✅ Executou
- ✅ Criou SyncRun
- ❌ Marcou como FAILED
- ❌ Não sincronizou nada

---

## 🆘 PRECISA DE AJUDA?

### **Script de Diagnóstico**

Use o script criado para verificar o status:

```bash
node scripts/check-cron-status.js
```

**O script verifica:**
- ✅ CRON_SECRET configurada
- ✅ Empresas com conexão válida
- ✅ Últimas sincronizações (24h)
- ✅ Status de cada sincronização
- ✅ Diagnóstico de problemas

**Nota**: Requer acesso ao banco de dados (rodar em produção ou com DATABASE_URL local).

---

## ✅ CHECKLIST DE RESOLUÇÃO

- [ ] Reconectei ao Tiny em `/admin/conexoes-tiny`
- [ ] Verifiquei que conexão está "Conectado" e com data futura
- [ ] Testei sincronização manual e funcionou
- [ ] Dados aparecem nos relatórios
- [ ] Verifiquei que cron está Enabled no painel Vercel
- [ ] Anotei data de expiração da nova conexão
- [ ] Configurei lembrete para renovar em [data]

---

**Última atualização**: 10/01/2026  
**Autor**: Sistema de Diagnóstico Automático
