# 📋 Limitações da API Tiny - Contas a Receber

## 🔍 Investigação Realizada em 09/01/2026

### Endpoints Analisados

1. **Lista**: `GET /contas-receber?dataInicial=X&dataFinal=Y`
2. **Detalhe**: `GET /contas-receber/{id}`

---

## ⚠️ Campos Parcialmente Disponíveis

### 1. **CATEGORIA**
- **Status na API**: `"categoria": {"id": 123, "descricao": "Nome"}` **OU** `null`
- **Disponibilidade**: ✅ Disponível quando a conta tem categoria vinculada
- **Tratamento no sistema**: 
  - Se existe: Exibe `categoria.descricao` (ex: "Vendas Online Marketplace")
  - Se não existe: Exibe `"N/D"`
- **Tipo de categoria**: Categorias financeiras (endpoint `/categorias-receita-despesa`)
- **Observação**: Nem todas as contas têm categoria vinculada

## ❌ Campos NÃO Disponíveis

### 1. **CENTRO DE CUSTO**
- **Status na API**: Campo não existe no JSON (nem como `null`)
- **Tratamento no sistema**: `null` (campo opcional no banco)
- **Justificativa**: Campo não é populado pelo Tiny ERP para contas a receber

### 2. **PLANO DE CONTAS**
- **Status na API**: Campo não existe no JSON
- **Tratamento no sistema**: Não mapeado
- **Justificativa**: Campo não é populado pelo Tiny ERP para contas a receber

---

## 📚 Tipos de Categorias no Tiny ERP

A API Tiny possui **3 tipos** de categorias:

| Tipo | Endpoint | Uso | Estrutura |
|------|----------|-----|-----------|
| **Produtos** | `/categorias/todas` | Categorização de produtos (escovas, cêras, interdentais) | Hierárquica (com `filhas`) |
| **Financeiras** | `/categorias-receita-despesa` | Categorias de receitas e despesas (administrativas, operacionais) | Plana (com `grupo`) |
| **Vinculadas** | Campo `categoria` em contas | Referência a uma categoria financeira | Objeto `{id, descricao}` |

**Para contas a receber**: Quando existe, o campo `categoria` faz referência às **categorias financeiras** (tipo 2).

---

## ✅ Campos Disponíveis

| Campo | Origem | Tipo | Observações |
|-------|--------|------|-------------|
| **ID Título** | `id` | number | ✅ Disponível |
| **Cliente** | `cliente.nome` | string | ✅ Disponível |
| **CNPJ/CPF** | `cliente.cpfCnpj` | string | ✅ Disponível |
| **Data Emissão** | `data` | date | ✅ Disponível |
| **Data Vencimento** | `dataVencimento` | date | ✅ Disponível |
| **Valor** | `valor` | decimal | ✅ Disponível |
| **Situação** | `situacao` | string | ✅ Disponível (aberto, pago, etc) |
| **Categoria** | ❌ | - | **NÃO disponível** (sempre `null`) |
| **Centro Custo** | ❌ | - | **NÃO disponível** (campo não existe) |

---

## 📊 Exemplos de Respostas Reais da API

### Conta **COM** Categoria

```json
{
  "id": 914806145,
  "situacao": "aberto",
  "data": "2026-01-09",
  "dataVencimento": "2026-01-09",
  "numeroDocumento": "012086/01",
  "valor": 132.62,
  "cliente": {
    "nome": "Priscila Bohn",
    "cpfCnpj": "016.419.820-20",
    "id": 760789158
  },
  "categoria": {  // ← ✅ COM CATEGORIA
    "id": 809715706,
    "descricao": "Vendas Online Marketplace"
  },
  "historico": "Ref. a NF nº 12085..."
}
```

### Conta **SEM** Categoria

```json
{
  "id": 914800000,
  "situacao": "aberto",
  "data": "2026-01-09",
  "dataVencimento": "2026-01-09",
  "numeroDocumento": "012080/01",
  "valor": 0,
  "cliente": {
    "nome": "Daniel de Oliveira Napoleão",
    "cpfCnpj": "097.244.859-43",
    "id": 760789000
  },
  "categoria": null,  // ← ❌ SEM CATEGORIA
  "historico": "Ref. a NF nº 12086..."
}
```

**Observação**: Não há campo `centroCusto` ou `centro_custo` no JSON em nenhum caso.

---

## 🛠️ Implementação no Sistema

### Transformer: `transformContaReceberToPosicao`

```typescript
// lib/tiny/transformers.ts
export function transformContaReceberToPosicao(
  companyId: string,
  conta: unknown,
  dataPosicao: Date = new Date()
): VwContasReceberPosicaoInput {
  const contaObj = conta as Record<string, unknown>;
  
  // Categoria: API retorna objeto {id, descricao} quando existe, ou null
  const categoriaObj = contaObj.categoria as Record<string, unknown> | null;
  let categoria = "N/D";
  if (categoriaObj && typeof categoriaObj === 'object' && categoriaObj.descricao) {
    categoria = String(categoriaObj.descricao);
  }
  
  // Centro de Custo: campo não existe na API
  const centroCusto = null;
  
  return {
    // ... outros campos ...
    categoria,      // "Vendas Online Marketplace" OU "N/D"
    centroCusto,    // Sempre null
    // ...
  };
}
```

---

## 📝 Recomendações

1. **Interface do usuário**: Mostrar tooltip explicando que esses campos não estão disponíveis na API Tiny
2. **Relatórios**: Considerar ocultar ou marcar visualmente as colunas indisponíveis
3. **Documentação do cliente**: Informar que categoria/centro de custo não fazem parte do módulo de contas a receber no Tiny ERP

---

## 🔄 Alternativas Futuras

Se houver necessidade de preencher esses campos:

1. **Integração manual**: Permitir usuário associar categorias/centros de custo via interface
2. **Regras de negócio**: Criar mapeamento baseado em cliente ou histórico
3. **Outro endpoint**: Verificar se Tiny oferece outro endpoint que forneça esses dados

---

**Data da análise**: 09/01/2026  
**Scripts de validação**: 
- `scripts/inspect-contas-receber.js`
- `scripts/inspect-conta-receber-detalhe.js`
