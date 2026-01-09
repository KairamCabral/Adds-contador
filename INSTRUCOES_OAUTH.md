# ✅ Configuração Correta do OAuth Tiny ERP (Olist)

## 📌 Informação Importante:

**Tiny agora é Olist!** O sistema usa **Keycloak/OIDC** para autenticação.

---

## 🔐 Endpoints Corretos:

### OAuth/OIDC (Keycloak):
- **Authorization URL**: `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth`
- **Token URL**: `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token`

### API REST:
- **Base URL**: `https://erp.tiny.com.br/public-api/v3`

---

## 📝 Configuração do `.env`:

Abra o arquivo `.env` e **atualize** (ou adicione) estas variáveis:

```env
# OAuth Tiny/Olist (Keycloak)
TINY_AUTH_BASE=https://accounts.tiny.com.br
TINY_REDIRECT_URI=http://localhost:3000/api/tiny/callback

# API Tiny V3
TINY_API_BASE=https://erp.tiny.com.br/public-api/v3

# Credenciais (já configuradas)
TINY_CLIENT_ID=tiny-api-26468819e59f580baea6e238dfef2cb1bad1d112-1767818571
TINY_CLIENT_SECRET=[seu secret]
```

---

## 🚀 Próximos Passos:

1. ✅ **Código já atualizado** com os endpoints corretos
2. 📝 **Atualize o `.env`** conforme acima
3. 🔄 **Reinicie o servidor**:
   - Pare com `Ctrl+C` no terminal
   - Execute: `npm run dev`
4. 🧪 **Teste a conexão OAuth**:
   - Acesse: http://localhost:3000/admin/conexoes-tiny
   - Clique em **"Conectar Tiny"**
   - Deve redirecionar para a página de login do Tiny/Olist
   - Após autorizar, deve voltar para o sistema

---

## 📚 Referência:

- **Painel de Desenvolvedor**: https://erp.tiny.com.br/
- **Console de Aplicações**: Configurações > Integrações > API
- **Documentação**: Dentro do painel ERP Tiny

---

## ✅ Correções Aplicadas no Código:

1. **`lib/tiny/oauth.ts`**: Endpoints OAuth/OIDC corrigidos
2. **`lib/tiny/client.ts`**: Base URL da API corrigida
3. **`lib/config.ts`**: Defaults atualizados

**Agora é só atualizar o `.env` e testar!** 🎉
