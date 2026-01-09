# 🚀 Guia Rápido - Sincronização Automática

## ✅ O que você precisa fazer AGORA

### 1. Deploy na Vercel

```bash
git add .
git commit -m "feat: adiciona sincronização automática e melhorias de UI"
git push
```

### 2. Verificar Variável `CRON_SECRET`

**No painel da Vercel:**
1. Acesse: Settings > Environment Variables
2. Procure por: `CRON_SECRET`
3. Se não existir, crie com:

```bash
# No seu terminal local:
openssl rand -base64 32
```

Copie o resultado e adicione como variável de ambiente na Vercel.

### 3. Verificar Cron Job (após deploy)

**No painel da Vercel:**
1. Acesse: Settings > Cron Jobs
2. Deve aparecer automaticamente:
   - Path: `/api/admin/sync`
   - Schedule: `0 3 * * *`
   - Status: ✅ Enabled

Se não aparecer, adicione manualmente com esses valores.

---

## 🎉 Pronto! Agora o sistema:

✅ Sincroniza automaticamente **todo dia às 3h da manhã**
✅ Interface melhorada com seletor de período
✅ Permite sincronizar mês específico
✅ Mostra status visual da sincronização
✅ Muito mais rápido (30 dias ao invés de 90)

---

## 🧪 Como Testar

### Teste 1: Nova Interface
1. Acesse qualquer relatório
2. Veja o novo painel de sincronização no lado direito
3. Teste o botão "Sincronizar Agora"

### Teste 2: Seleção de Mês
1. Clique na aba "Mês Específico"
2. Selecione um mês anterior
3. Clique em "Sincronizar [mês]"

### Teste 3: Cron Manual (opcional)
```bash
curl -X POST https://seu-app.vercel.app/api/admin/sync \
  -H "Authorization: Bearer SEU_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## 📚 Documentação Completa

Para mais detalhes, veja: `docs/SINCRONIZACAO_AUTOMATICA.md`

---

**Tempo estimado de configuração**: 5-10 minutos
**Dificuldade**: ⭐ Fácil

