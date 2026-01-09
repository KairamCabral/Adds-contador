# 🔄 Sincronização Automática - Guia Completo

## 📋 Resumo das Implementações

Este documento explica todas as melhorias implementadas no sistema de sincronização do Contador ADDS.

---

## ✅ O que foi implementado

### 1. **Sincronização Automática Diária (Cron Job)**
- ✅ Arquivo `vercel.json` criado
- ✅ Sincronização automática às **3h da manhã** (horário de Brasília)
- ✅ Executada automaticamente sem intervenção do usuário
- ✅ Não bloqueia o sistema durante o dia
- ✅ Lookback otimizado para cron: 30 dias (ao invés de 90)

### 2. **Sincronização por Período Específico**
- ✅ Nova API `/api/admin/sync/period` criada
- ✅ Permite sincronizar apenas um mês específico
- ✅ Muito mais rápido que sincronização completa

### 3. **Interface de Usuário Melhorada**
- ✅ Novo componente `SyncControls` com:
  - Indicador visual de status (verde/amarelo/vermelho)
  - Seletor de modo de sincronização (Rápida vs Mês Específico)
  - Seletor de mês (dropdown)
  - Informações de última sincronização
  - Botões de ação intuitivos
  - Mensagens de erro/sucesso claras

### 4. **Otimizações no Backend**
- ✅ Função `runSync()` aceita parâmetros de data
- ✅ Todas as funções de sync suportam período customizado
- ✅ Lookback reduzido para cron (30 dias ao invés de 90)

---

## 🚀 Como Usar

### **Modo 1: Sincronização Automática (Cron)**

**Não requer ação do usuário!**

1. Sistema sincroniza automaticamente todo dia às **3h da manhã**
2. Sincroniza últimos **30 dias** de dados
3. Quando o contador chegar pela manhã, os dados já estarão atualizados

**Status**: ✅ Já configurado automaticamente

### **Modo 2: Sincronização Manual Rápida**

Para sincronizar manualmente os últimos 30 dias:

1. Acesse qualquer página de relatórios
2. No painel lateral direito, clique em **"Sincronizar Agora"**
3. Aguarde (2-3 minutos)
4. Página recarrega automaticamente com dados atualizados

### **Modo 3: Sincronização de Mês Específico**

Para sincronizar um mês específico (ex: dezembro/2024):

1. Acesse qualquer página de relatórios
2. No painel lateral direito, clique na aba **"Mês Específico"**
3. Selecione o mês desejado no dropdown
4. Clique em **"Sincronizar [mês selecionado]"**
5. Aguarde (tempo varia conforme volume de dados)
6. Página recarrega automaticamente

---

## 🔧 Configuração (Deploy na Vercel)

### Passo 1: Deploy do Código

```bash
# Commit as mudanças
git add .
git commit -m "feat: adiciona sincronização automática e por período"
git push
```

### Passo 2: Verificar Variáveis de Ambiente

No painel da Vercel, verifique que existe a variável:

```
CRON_SECRET=<valor_secreto>
```

Se não existir, gerar com:

```bash
openssl rand -base64 32
```

E adicionar nas variáveis de ambiente da Vercel.

### Passo 3: Verificar Cron Job

Após o deploy:

1. Acesse o painel da Vercel
2. Vá em **Settings > Cron Jobs**
3. Verifique se aparece:
   - **Path**: `/api/admin/sync`
   - **Schedule**: `0 3 * * *` (todo dia às 3h UTC / 0h BRT)
   - **Status**: Enabled

Se não aparecer automaticamente, adicione manualmente.

### Passo 4: Testar

**Teste da Interface:**
1. Acesse qualquer relatório
2. Verifique se o novo painel de sincronização aparece
3. Teste os modos "Rápida" e "Mês Específico"

**Teste do Cron:**
```bash
# Chamar manualmente a API de cron (substitua os valores)
curl -X POST https://seu-app.vercel.app/api/admin/sync \
  -H "Authorization: Bearer SEU_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## 📊 Diferenças entre os Modos

| Característica | Cron Automático | Sincronização Rápida | Mês Específico |
|----------------|-----------------|----------------------|----------------|
| **Frequência** | 1x por dia (3h) | Sob demanda | Sob demanda |
| **Período** | Últimos 30 dias | Últimos 30 dias | Mês selecionado |
| **Tempo** | ~2-3 minutos | ~2-3 minutos | Varia (1-5 min) |
| **Uso** | Automático | Manual | Manual |
| **Quando usar** | Rotina diária | Atualização urgente | Auditoria/histórico |

---

## 🎯 Casos de Uso

### Caso 1: Rotina Diária do Contador
**Solução**: Cron automático
- Contador chega às 8h
- Dados do mês atual já sincronizados
- Pode trabalhar imediatamente

### Caso 2: Preciso de Dados de Hoje Urgentemente
**Solução**: Sincronização Rápida
- Clica em "Sincronizar Agora"
- Aguarda 2-3 minutos
- Dados atualizados

### Caso 3: Auditoria do Mês de Dezembro/2024
**Solução**: Mês Específico
- Seleciona "Dezembro 2024"
- Clica em "Sincronizar Dezembro 2024"
- Aguarda sincronização completa do mês

### Caso 4: Primeira Sincronização (Empresa Nova)
**Solução**: Sincronização Rápida (várias vezes se necessário)
- Sincroniza últimos 30 dias
- Se precisar de mais histórico, seleciona meses anteriores um a um

---

## 📈 Melhorias de Performance

### Antes
- ❌ Sincronizava sempre 90 dias
- ❌ Timeout de 13 minutos
- ❌ Bloqueava interface
- ❌ Sem opção de período customizado

### Depois
- ✅ Cron sincroniza apenas 30 dias
- ✅ Sincronização manual pode escolher período
- ✅ Interface mostra progresso
- ✅ Mensagens claras de status

---

## 🐛 Troubleshooting

### Problema: Cron não está executando

**Verificar**:
1. Painel Vercel > Settings > Cron Jobs
2. Verificar se está "Enabled"
3. Verificar logs em Vercel > Deployments > Logs

**Solução**:
```bash
# Recriar o cron manualmente no painel da Vercel
Path: /api/admin/sync
Schedule: 0 3 * * *
```

### Problema: "Proibido" ao sincronizar

**Causa**: `CRON_SECRET` não está configurado ou está incorreto

**Solução**:
1. Gerar novo secret: `openssl rand -base64 32`
2. Adicionar em Vercel > Settings > Environment Variables
3. Redeploy

### Problema: Sincronização por mês não funciona

**Causa**: Rota `/api/admin/sync/period` não foi deployada

**Solução**:
```bash
# Verificar se arquivo existe
ls app/api/admin/sync/period/route.ts

# Se não existir, criar novamente e fazer commit/push
```

### Problema: Interface antiga ainda aparece

**Causa**: Cache do navegador

**Solução**:
- Fazer hard refresh: `Ctrl + Shift + R` (ou `Cmd + Shift + R` no Mac)
- Limpar cache do navegador

---

## 📝 Notas Técnicas

### Arquivos Modificados
```
vercel.json                          # NOVO - Configuração de cron
components/sync-controls.tsx         # NOVO - Componente de UI melhorado
app/api/admin/sync/period/route.ts   # NOVO - API de sincronização por período
jobs/sync.ts                         # MODIFICADO - Suporte a período customizado
app/relatorios/[view]/page.tsx       # MODIFICADO - Usa novo componente
```

### Fluxo de Sincronização

```
┌─────────────────┐
│  Cron (3h AM)   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ /api/admin/sync │
│  (isCron=true)  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  runSync()      │
│  lookback=30d   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  syncByModule() │
│  (todos módulos)│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Banco de Dados  │
│   (PostgreSQL)  │
└─────────────────┘
```

---

## 🎉 Benefícios

1. **Produtividade**: Contador não precisa esperar sincronização
2. **Performance**: Sincronizações mais rápidas (30 dias vs 90 dias)
3. **Flexibilidade**: Pode sincronizar período específico quando necessário
4. **Confiabilidade**: Dados sempre atualizados automaticamente
5. **UX Melhorada**: Interface clara e intuitiva

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verificar logs no painel da Vercel
2. Consultar esta documentação
3. Verificar tabela `SyncRun` no banco de dados para histórico

---

**Última atualização**: 08/01/2026
**Versão**: 2.0

