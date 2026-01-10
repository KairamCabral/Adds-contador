# 🏦 LIMITAÇÃO: Conta Bancária de Destino (Contas a Receber)

## ❌ PROBLEMA IDENTIFICADO

O usuário solicitou que o campo **"Conta Bancária"** em "Contas Recebidas" mostrasse **onde o dinheiro foi recebido** (ex: "Banco do Brasil", "Olist Conta Digital", "323 Mercado Pago").

Este campo aparece como **"N/D"** (Não Disponível) na aplicação.

---

## 🔍 INVESTIGAÇÃO REALIZADA

### 1️⃣ **Análise do JSON da API**

Foram analisados:
- ✅ Endpoint de listagem: `/contas-receber?situacao=pago`
- ✅ Endpoint de detalhe: `/contas-receber/{id}`

**Resultado:**
- ❌ Nenhum campo `contaBancaria`, `contaDestino`, `contaRecebimento` encontrado
- ❌ Nenhum campo `destino`, `conta_corrente`, `banco_destino` encontrado

### 2️⃣ **Campo `numeroBanco`**

Foi encontrado o campo `numeroBanco` na listagem:

```json
{
  "id": 914763106,
  "numeroBanco": "5935495",
  "cliente": {...}
}
```

**Problemas:**
1. **97% das contas têm `numeroBanco: null`**
2. Quando preenchido, **não há endpoint para mapear o ID para o nome**
   - Testado: `/bancos/5935495` → 404
   - Testado: `/contas-bancarias/5935495` → 404
   - Testado: `/contas-correntes/5935495` → 404

### 3️⃣ **Busca por Endpoints de Contas Bancárias**

Testados os seguintes endpoints para listar contas da empresa:
- ❌ `/bancos` → 404
- ❌ `/contas-bancarias` → 404
- ❌ `/contas-correntes` → 404
- ❌ `/contas-empresa` → 404

**Conclusão:** Não existe endpoint para listar ou buscar contas bancárias da empresa.

### 4️⃣ **Busca Recursiva Completa**

Foi feita uma busca recursiva em **TODOS os campos** do JSON (até 10 níveis de profundidade) procurando por palavras-chave:
- banco, conta, destino, receb, pagam, caixa, corrente, deposit, transfer

**Resultado:**
- ✅ `formaRecebimento`: Encontrado e **já implementado** ("Boleto", "PIX", etc.)
- ❌ `contaBancaria` ou similar: **NÃO EXISTE**

---

## 🎯 CONCLUSÃO

A API Tiny v3 **NÃO fornece** a informação de conta bancária de destino para contas a receber.

**O que a API oferece:**
- ✅ Forma de recebimento (Boleto, PIX, Cartão, etc.)
- ❌ Conta bancária onde o dinheiro foi depositado

---

## ✅ SOLUÇÃO IMPLEMENTADA

O campo **"Conta Bancária"** permanece como **"N/D"** (Não Disponível) pois:

1. É uma **limitação técnica da API Tiny**
2. Não há **workaround ou solução alternativa**
3. O campo **"Forma de Recebimento"** está **correto** e já mostra informação útil

---

## 📊 CAMPOS DISPONÍVEIS EM "CONTAS RECEBIDAS"

| Campo | Status | Fonte |
|-------|--------|-------|
| Cliente | ✅ Correto | `cliente.nome` |
| CNPJ/CPF | ✅ Correto | `cliente.cpfCnpj` |
| Categoria | ✅ Correto | `categoria.descricao` (detalhe) |
| Centro de Custo | ⚠️ N/D | Não existe na API |
| Data Emissão | ✅ Correto | `data` |
| Data Vencimento | ✅ Correto | `dataVencimento` |
| Data Recebimento | ✅ Correto | `dataLiquidacao` |
| Valor Título | ✅ Correto | `valor` |
| Valor Recebido | ✅ Correto | `valorPago` |
| **Conta Bancária** | **⚠️ N/D** | **Não existe na API** |
| **Forma Recebimento** | **✅ Correto** | **`formaRecebimento.nome` (detalhe)** |

---

## 📝 SCRIPTS DE INVESTIGAÇÃO CRIADOS

1. `scripts/verificar-numero-banco.js` - Verifica presença do campo `numeroBanco`
2. `scripts/verificar-numero-banco-todas.js` - Estatísticas de `numeroBanco` em todas as contas
3. `scripts/investigar-destino-recebimento.js` - Tenta mapear `numeroBanco` e buscar endpoints
4. `scripts/busca-recursiva-destino.js` - Busca recursiva completa por campos relacionados

---

## 🔗 REFERÊNCIAS

- **API Tiny v3**: https://erp.tiny.com.br/public-api/v3/
- **Endpoint**: `/contas-receber` e `/contas-receber/{id}`
- **Data da Investigação**: 09/01/2026

---

## ✅ AÇÃO RECOMENDADA

**Aceitar a limitação** e manter o campo como "N/D".

**Alternativas (fora da API):**
- Consultar o Tiny ERP manualmente para verificar se essa informação está disponível na interface web
- Solicitar ao suporte do Tiny ERP a inclusão deste campo na API v3
- Implementar solução manual (cadastro de mapeamento conta → destino) se absolutamente necessário

---

_Documentação criada em: 09/01/2026_
_Última atualização: 09/01/2026_
