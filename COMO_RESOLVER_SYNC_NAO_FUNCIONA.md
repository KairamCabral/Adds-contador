# 🔧 COMO RESOLVER: Sincronização Não Está Funcionando

## 🚨 O PROBLEMA

A sincronização automática (que deveria rodar às 3h da manhã) **não está funcionando** porque:

### ❌ **Sua conexão com o Tiny ERP EXPIROU**

As conexões OAuth expiram após ~90 dias e precisam ser renovadas manualmente.

---

## ✅ SOLUÇÃO (5 MINUTOS)

### **1. RECONECTAR AO TINY** (URGENTE!)

1. Acesse: **https://adds-contador.vercel.app/admin/conexoes-tiny**

2. Se houver uma conexão antiga, clique em **"Desconectar"**

3. Clique em **"Conectar ao Tiny"**

4. Autorize o acesso no Tiny ERP

5. Você será redirecionado de volta → verifique se aparece **"✅ Conectado"**

---

### **2. TESTAR SINCRONIZAÇÃO**

1. Vá para qualquer relatório, por exemplo:  
   **https://adds-contador.vercel.app/relatorios/vw_contas_receber_posicao**

2. Clique no botão **"Sincronizar Agora"** (canto superior direito)

3. Aguarde 2-3 minutos

4. Os dados devem aparecer!

---

### **3. PRÓXIMA SINCRONIZAÇÃO AUTOMÁTICA**

Após reconectar, o sistema voltará a sincronizar automaticamente:
- ⏰ **Todos os dias às 3h da manhã**
- 📊 **Últimos 30 dias de dados**
- ✅ **Sem intervenção manual**

---

## 🔍 VERIFICAÇÕES ADICIONAIS (OPCIONAL)

### **Verificar se o Cron está Habilitado na Vercel**

Se após reconectar ainda não funcionar:

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings → Cron Jobs**
4. Verifique se está **"Enabled"**

Se não estiver, clique em "Enable".

---

## 📅 LEMBRETE IMPORTANTE

**Anotar data de expiração da nova conexão:**

A nova conexão expirará em aproximadamente **90 dias** (cerca de **Abril/2026**).

💡 **Configure um lembrete** para renovar a conexão em **Março/2026** (antes de expirar novamente).

---

## 🆘 PROBLEMAS?

### **Erro: "Proibido" ao sincronizar**
- Certifique-se de estar logado como ADMIN ou OPERADOR

### **Erro: "Nenhuma empresa encontrada"**
- Verifique se a empresa foi cadastrada em `/admin/empresas`

### **Sincronização manual funciona, mas automática não**
- Verifique configuração do cron no painel Vercel (item acima)

### **Dados não aparecem mesmo após sincronizar**
- Verifique se há erros nos logs da sincronização
- Tente sincronizar um período menor (ex: dezembro/2025)

---

## 📞 SUPORTE TÉCNICO

Se o problema persistir após seguir todos os passos:

1. **Executar diagnóstico completo:**
   ```bash
   node scripts/check-cron-status.js
   ```

2. **Verificar logs no Vercel:**
   - Dashboard → Deployments → Logs
   - Procure por erros relacionados a "Sync"

3. **Consultar documentação:**
   - `DIAGNOSTICO_CRON_SYNC.md` (diagnóstico detalhado)
   - `docs/SINCRONIZACAO_AUTOMATICA.md` (guia completo)

---

**Criado em**: 10/01/2026  
**Tempo para resolver**: ~5 minutos  
**Prioridade**: 🔴 URGENTE
