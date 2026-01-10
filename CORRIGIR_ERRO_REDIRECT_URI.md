# 🔧 CORRIGIR: Erro "Invalid parameter: redirect_uri"

## 🚨 O PROBLEMA

Você vê **"Conectado"** na página, mas ao clicar em **"Conectar Tiny"** recebe:

```
Invalid parameter: redirect_uri
```

**Causa**: A URL de callback OAuth não está registrada corretamente no painel do Tiny ERP (Olist).

---

## ✅ SOLUÇÃO (2 MÉTODOS)

### **MÉTODO 1: Corrigir no Painel do Tiny/Olist** ⭐ RECOMENDADO

#### **Passo 1: Acessar Painel de Desenvolvedores Tiny**

1. Acesse: https://accounts.tiny.com.br (ou painel de desenvolvedores Tiny)
2. Faça login com suas credenciais
3. Vá em **"Aplicações"** ou **"My Applications"**
4. Encontre a aplicação **"ADDS Contador"** (ou nome que você usou)

#### **Passo 2: Verificar/Adicionar URL de Callback**

Procure por um campo como:
- **"Redirect URIs"**
- **"URLs de Redirecionamento"**
- **"Callback URLs"**

**IMPORTANTE**: Adicione EXATAMENTE esta URL:

```
https://adds-contador.vercel.app/api/tiny/callback
```

**Observações:**
- ✅ Usar **HTTPS** (não HTTP)
- ✅ Sem **/** no final
- ✅ Copiar exatamente como está
- ⚠️ Se seu domínio for diferente, ajuste para seu domínio Vercel

#### **Passo 3: Salvar e Aguardar**

1. Clique em **"Salvar"** ou **"Save"**
2. Aguarde alguns segundos para propagação
3. Volte para: https://adds-contador.vercel.app/admin/conexoes-tiny
4. Clique em **"Conectar Tiny"** novamente
5. ✅ Deve funcionar!

---

### **MÉTODO 2: Verificar/Corrigir Variável na Vercel** 

Se o Método 1 não resolver, o problema pode estar na variável de ambiente.

#### **Passo 1: Verificar TINY_REDIRECT_URI**

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto **"adds-contador"**
3. Vá em **Settings → Environment Variables**
4. Procure por: **`TINY_REDIRECT_URI`**

#### **Passo 2: Verificar/Corrigir Valor**

**O valor DEVE SER:**

```
https://adds-contador.vercel.app/api/tiny/callback
```

**Verificar:**
- ✅ Está usando **HTTPS** (não HTTP)
- ✅ URL do seu domínio Vercel está correta
- ✅ Termina com `/api/tiny/callback` (sem / no final)
- ✅ Não tem espaços antes/depois
- ✅ Não tem **www.** (a menos que seu domínio use)

#### **Passo 3: Se Precisar Corrigir**

1. Clique no ícone de **"Edit"** (lápis) ao lado da variável
2. Cole o valor correto
3. Clique em **"Save"**
4. **IMPORTANTE**: Você DEVE fazer um **novo deploy** para aplicar:
   - Vá em **Deployments**
   - Clique nos **três pontinhos** do último deploy
   - Selecione **"Redeploy"**
   - Aguarde o deploy completar (~2 minutos)

#### **Passo 4: Testar**

1. Acesse: https://adds-contador.vercel.app/admin/conexoes-tiny
2. Clique em **"Conectar Tiny"**
3. ✅ Deve funcionar!

---

## 🔍 VERIFICAÇÃO RÁPIDA

### **Como saber qual método usar?**

**Use MÉTODO 1 se:**
- É a primeira vez conectando
- Mudou recentemente o domínio do projeto
- Criou a aplicação no Tiny há pouco tempo

**Use MÉTODO 2 se:**
- Já funcionou antes
- Mudou algo na configuração da Vercel
- Fez redeploy recentemente

**Use AMBOS se:**
- Não tem certeza
- Nenhum dos dois resolveu sozinho

---

## 📋 CHECKLIST COMPLETO

### **No Painel Tiny/Olist:**
- [ ] Acessei painel de desenvolvedores
- [ ] Encontrei minha aplicação
- [ ] Verifiquei "Redirect URIs"
- [ ] Adicionei: `https://adds-contador.vercel.app/api/tiny/callback`
- [ ] Salvei as alterações

### **Na Vercel:**
- [ ] Acessei Settings → Environment Variables
- [ ] Verifiquei `TINY_REDIRECT_URI`
- [ ] Valor está correto: `https://adds-contador.vercel.app/api/tiny/callback`
- [ ] Se alterei, fiz Redeploy
- [ ] Aguardei deploy completar

### **Teste Final:**
- [ ] Acessei `/admin/conexoes-tiny`
- [ ] Cliquei em "Conectar Tiny"
- [ ] Autorizei no Tiny ERP
- [ ] Fui redirecionado de volta
- [ ] Aparece "✅ Conectado"

---

## 🐛 TROUBLESHOOTING

### **Problema: Ainda dá o mesmo erro**

**Possíveis causas:**

1. **URLs não coincidem EXATAMENTE**
   - No Tiny: `https://adds-contador.vercel.app/api/tiny/callback`
   - Na Vercel: `https://adds-contador.vercel.app/api/tiny/callback`
   - Devem ser **IDÊNTICAS** (case-sensitive)

2. **Esqueceu de fazer Redeploy**
   - Após mudar variável de ambiente, DEVE fazer redeploy
   - A variável só é aplicada no próximo deploy

3. **Domínio customizado**
   - Se usa domínio próprio (ex: `sistema.suaempresa.com.br`)
   - Use o domínio customizado na URL, não o `.vercel.app`

4. **Cache do navegador**
   - Limpe cache: Ctrl+Shift+Delete (ou Cmd+Shift+Delete no Mac)
   - Ou use navegador anônimo para testar

---

### **Problema: "State inválido" ou "State expirado"**

Isso é diferente do erro de `redirect_uri`. Se receber este erro:

1. Tente novamente (o state expira em 10 minutos)
2. Não demore muito na tela de autorização do Tiny
3. Se persistir, verifique variável `AUTH_SECRET` na Vercel

---

### **Problema: Redirecionou mas dá erro 404**

Significa que a rota `/api/tiny/callback` não existe. Verifique:

1. Arquivo existe: `app/api/tiny/callback/route.ts`
2. Fez deploy do código atualizado
3. Último deploy na Vercel foi bem-sucedido

---

## 📝 EXEMPLO REAL

### **Configuração CORRETA:**

**No Painel Tiny/Olist:**
```
Application Name: ADDS Contador
Redirect URIs: 
  - https://adds-contador.vercel.app/api/tiny/callback
```

**Na Vercel (Environment Variables):**
```
TINY_CLIENT_ID=tiny-api-26468819...
TINY_CLIENT_SECRET=xxxxxxxxxx
TINY_REDIRECT_URI=https://adds-contador.vercel.app/api/tiny/callback
TINY_AUTH_BASE=https://accounts.tiny.com.br
```

**Resultado:**
✅ Autenticação funciona perfeitamente

---

## 🎯 RESUMO EXECUTIVO

1. **Acesse painel Tiny** → Adicione URL de callback
2. **Verifique Vercel** → Confirme variável `TINY_REDIRECT_URI`
3. **URLs devem ser IDÊNTICAS** em ambos os lugares
4. **Redeploy se necessário** (após mudar variável)
5. **Teste conexão** novamente

**Tempo estimado**: 5-10 minutos

---

## 📞 AINDA COM PROBLEMAS?

### **Verificação Final:**

Execute este comando no terminal da sua máquina:

```bash
curl -s "https://adds-contador.vercel.app/api/config" | grep -i redirect
```

Isso mostrará qual `TINY_REDIRECT_URI` está configurada em produção.

Compare com o que está registrado no Tiny. **DEVEM SER IDÊNTICAS.**

---

**Criado em**: 10/01/2026  
**Problema**: Invalid parameter: redirect_uri  
**Prioridade**: 🔴 Alta  
**Tempo para resolver**: ~10 minutos
