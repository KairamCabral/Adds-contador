# 🔑 CORRIGIR: ENCRYPTION_MASTER_KEY

## 🚨 O PROBLEMA

Você recebeu o erro:

```
❌ Erro: ENCRYPTION_MASTER_KEY deve ter 32 bytes (base64)
```

**Causa**: A variável `ENCRYPTION_MASTER_KEY` não está configurada na Vercel ou está inválida.

---

## ✅ SOLUÇÃO (5 MINUTOS)

### **SUA CHAVE GERADA:**

```
QjG1yKxPbReB/P0L/2rYUueNcUz93F6fST+UP2ZZmVE=
```

⚠️ **IMPORTANTE**: Guarde essa chave em local seguro! Se perder, precisará reconectar todas as empresas.

---

## 📋 PASSO-A-PASSO:

### **1. Acessar Vercel**

1. Vá em: https://vercel.com/dashboard
2. Selecione seu projeto **"adds-contador"**
3. Clique em **Settings** (menu lateral)
4. Clique em **Environment Variables**

---

### **2. Adicionar Variável**

1. Clique no botão **"Add New"**
2. Preencha:
   - **Name**: `ENCRYPTION_MASTER_KEY`
   - **Value**: `QjG1yKxPbReB/P0L/2rYUueNcUz93F6fST+UP2ZZmVE=`
   - **Environments**: Marque **TODOS** (Production, Preview, Development)

3. Clique em **"Save"**

---

### **3. Fazer Redeploy**

**IMPORTANTE**: A variável só é aplicada após um novo deploy!

1. Vá na aba **"Deployments"**
2. No último deployment, clique nos **três pontinhos (⋮)**
3. Selecione **"Redeploy"**
4. Confirme
5. Aguarde ~2 minutos

---

### **4. Testar Novamente**

Após o deploy completar:

1. Acesse: https://adds-contador.vercel.app/admin/conexoes-tiny
2. Clique em **"Conectar Tiny"**
3. Autorize no Tiny ERP
4. ✅ **Deve funcionar agora!**

---

## 🔍 VERIFICAR SE VARIÁVEL ESTÁ CONFIGURADA

Após adicionar a variável, você pode verificar em:

```
https://adds-contador.vercel.app/admin/diagnostico
```

A página mostrará o status de todas as variáveis (inclusive a que acabou de adicionar).

---

## ❓ POR QUE PRECISO DISSO?

### **Segurança dos Tokens**

O sistema precisa **encriptar** os tokens do Tiny antes de salvar no banco de dados:

```
Token do Tiny (sensível)
    ↓
Encriptação com ENCRYPTION_MASTER_KEY
    ↓
Token encriptado (seguro)
    ↓
Salva no banco de dados
```

**Sem a chave**:
- ❌ Não consegue encriptar tokens
- ❌ Não consegue salvar conexão
- ❌ Não conecta ao Tiny

**Com a chave**:
- ✅ Tokens encriptados com segurança
- ✅ Conexão salva no banco
- ✅ Sistema funciona normalmente

---

## ⚠️ AVISOS IMPORTANTES

### **1. Nunca Compartilhe a Chave**

Esta chave é como uma senha mestra. **NÃO**:
- ❌ Commitar no Git
- ❌ Compartilhar em chat/email
- ❌ Postar em fóruns públicos

### **2. Backup da Chave**

Guarde em local seguro (ex: gerenciador de senhas):
- Se perder a chave, **não consegue descriptografar** tokens antigos
- Precisará **reconectar todas empresas** ao Tiny

### **3. Mesma Chave em Todos Ambientes**

Use a **MESMA** chave em Production, Preview e Development:
- Facilita testes
- Evita problemas ao fazer deploy

---

## 🐛 TROUBLESHOOTING

### **Problema: "Ainda dá o mesmo erro"**

**Verificar:**

1. **Variável foi salva?**
   - Vá em Settings → Environment Variables
   - Confirme que `ENCRYPTION_MASTER_KEY` está lá

2. **Fez Redeploy?**
   - Variável só aplica após novo deploy
   - Deployments → Redeploy

3. **Aguardou deploy completar?**
   - Status deve estar "Ready"
   - Não "Building" ou "Error"

4. **Valor está correto?**
   - Deve ser exatamente: `QjG1yKxPbReB/P0L/2rYUueNcUz93F6fST+UP2ZZmVE=`
   - Sem espaços antes/depois
   - Case-sensitive (maiúsculas/minúsculas importam)

---

### **Problema: "Perdi a chave"**

Se perdeu a chave mas sistema já está funcionando:

1. **Verificar na Vercel:**
   - Settings → Environment Variables
   - Copie o valor de `ENCRYPTION_MASTER_KEY`
   - Guarde em local seguro

Se perdeu e não está na Vercel:

1. **Gerar nova chave:**
   ```bash
   node scripts/generate-encryption-key.js
   ```

2. **Adicionar nova chave na Vercel**

3. **IMPORTANTE**: Todas conexões antigas ficarão inválidas
   - Você precisará **reconectar todas empresas**
   - Não há como recuperar tokens antigos

---

### **Problema: "Outro erro apareceu"**

Se após adicionar a chave aparecer **OUTRO** erro:

1. **Anote o erro completo**
2. **Verifique outras variáveis:**
   - `TINY_CLIENT_ID`
   - `TINY_CLIENT_SECRET`
   - `TINY_REDIRECT_URI`
   - `AUTH_SECRET`

3. **Use página de diagnóstico:**
   ```
   https://adds-contador.vercel.app/admin/diagnostico
   ```
   Mostra status de TODAS as variáveis

---

## 🎯 CHECKLIST COMPLETO

- [ ] Executei `node scripts/generate-encryption-key.js`
- [ ] Copiei a chave gerada
- [ ] Guardei a chave em local seguro (gerenciador de senhas)
- [ ] Acessei Vercel → Settings → Environment Variables
- [ ] Adicionei variável `ENCRYPTION_MASTER_KEY`
- [ ] Marquei TODOS os ambientes (Production, Preview, Development)
- [ ] Cliquei em "Save"
- [ ] Fui em Deployments → Redeploy
- [ ] Aguardei deploy completar (status "Ready")
- [ ] Testei conexão em `/admin/conexoes-tiny`
- [ ] ✅ Funcionou!

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- `COMO_RESOLVER_SYNC_NAO_FUNCIONA.md` - Guia geral de conexão
- `CORRIGIR_ERRO_REDIRECT_URI.md` - Se der erro de redirect_uri
- `/admin/diagnostico` - Verificar todas variáveis

---

**Criado em**: 10/01/2026  
**Problema**: ENCRYPTION_MASTER_KEY ausente/inválida  
**Tempo para resolver**: ~5 minutos (+ 2 min de deploy)
