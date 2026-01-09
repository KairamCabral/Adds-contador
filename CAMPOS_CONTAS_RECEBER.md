# 📋 Mapa de Campos - Contas a Receber

## 🟢 Campos Disponíveis (API Tiny)

```
┌─────────────────┬──────────────────────────┬────────────────┐
│ Campo UI        │ Campo API                │ Status         │
├─────────────────┼──────────────────────────┼────────────────┤
│ ID Título       │ id                       │ ✅ OK          │
│ Cliente         │ cliente.nome             │ ✅ OK          │
│ CNPJ/CPF        │ cliente.cpfCnpj          │ ✅ OK          │
│ Data Emissão    │ data                     │ ✅ CORRIGIDO   │
│ Data Vencimento │ dataVencimento           │ ✅ OK          │
│ Valor           │ valor                    │ ✅ OK          │
│ Data Posição    │ (gerado pelo sistema)    │ ✅ OK          │
└─────────────────┴──────────────────────────┴────────────────┘
```

## 🔴 Campos Indisponíveis (API Tiny)

```
┌─────────────────┬──────────────────────────┬────────────────┐
│ Campo UI        │ Campo API                │ Status         │
├─────────────────┼──────────────────────────┼────────────────┤
│ Categoria       │ categoria (sempre null)  │ ❌ INDISPONÍVEL│
│ Centro Custo    │ (campo não existe)       │ ❌ INDISPONÍVEL│
└─────────────────┴──────────────────────────┴────────────────┘
```

---

## 📄 Exemplo de JSON Real (API Tiny)

```json
{
  "id": 914806145,
  "situacao": "aberto",
  "data": "2026-01-09",                    ← Data Emissão
  "dataVencimento": "2026-01-09",          ← Data Vencimento
  "valor": 132.62,                         ← Valor
  "numeroDocumento": "012086/01",
  "cliente": {
    "nome": "Daniel de Oliveira",          ← Cliente
    "cpfCnpj": "097.244.859-43",           ← CNPJ/CPF
    "id": 760789158
  },
  "categoria": null,                        ← ❌ Sempre null
  "historico": "Ref. a NF nº 12086..."
  // centroCusto: (não existe no JSON)     ← ❌ Campo não existe
}
```

---

## 🎯 Resultado Esperado na Tela

Após sincronização:

```
┌────────────┬──────────────────┬─────────────────┬───────────┬──────────────┬────────────┬────────────┬───────────┬──────────────┐
│ ID TÍTULO  │ CLIENTE          │ CNPJ            │ CATEGORIA │ CENTRO CUSTO │ EMISSÃO    │ VENCIMENTO │ VALOR     │ DATA POSIÇÃO │
├────────────┼──────────────────┼─────────────────┼───────────┼──────────────┼────────────┼────────────┼───────────┼──────────────┤
│ 914806145  │ Daniel Oliveira  │ 097.244.859-43  │ N/D       │ -            │ 09/01/2026 │ 09/01/2026 │ 547,20    │ 09/01/2026   │
│ 914790548  │ Sueli Souza      │ 304.299.618-20  │ N/D       │ -            │ 09/01/2026 │ 09/01/2026 │ 45,76     │ 09/01/2026   │
└────────────┴──────────────────┴─────────────────┴───────────┴──────────────┴────────────┴────────────┴───────────┴──────────────┘
```

**Legenda**:
- ✅ Campos preenchidos: Dados reais da API Tiny
- ⚠️ **N/D**: Campo não disponível na API (categoria sempre retorna `null`)
- ⚠️ **-**: Campo não existe na API (centroCusto não é fornecido)

---

## 🔍 Como Validar

### 1. Via Scripts de Diagnóstico

```bash
# Ver estrutura da listagem
node scripts/inspect-contas-receber.js

# Ver detalhe de uma conta específica
node scripts/inspect-conta-receber-detalhe.js
```

### 2. Via Interface

1. Acesse a aba "Contas a Receber"
2. Clique em "Sincronizar agora"
3. Verifique se os dados batem com a tabela acima

---

## 💡 Dica para Usuários

Se você precisa de **Categoria** ou **Centro de Custo**:

1. **Opção 1**: Cadastrar manualmente (funcionalidade futura)
2. **Opção 2**: Criar regras de negócio baseadas em cliente/histórico
3. **Opção 3**: Exportar para Excel e preencher manualmente

⚠️ **Importante**: Esses campos **não existem** na API Tiny para contas a receber. Não é um bug do sistema!

---

**📚 Documentação completa**: `docs/CONTAS_RECEBER_LIMITACOES.md`
