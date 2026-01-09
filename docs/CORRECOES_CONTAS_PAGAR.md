# 🔧 Correções Aplicadas - Contas a Pagar

## 📅 Data: 09/01/2026

---

## 🚨 **PROBLEMA IDENTIFICADO**

Na aba "Contas a Pagar", todos os campos apareciam como **"-"** (vazio), exceto:
- ✅ Datas (emissão e vencimento)
- ✅ Valores
- ✅ Status

### Campos Afetados
- ❌ **Fornecedor**: "-"
- ❌ **Categoria**: "-"
- ❌ **Centro Custo**: "-"
- ❌ **Forma Pagto**: "-"

---

## 🔍 **CAUSA RAIZ**

### 1. **Bug Crítico: Campo `cliente` vs `fornecedor`**

**Descoberta Surpreendente:** A API Tiny ERP usa o campo **`cliente`** mesmo para contas a **PAGAR**, não `fornecedor`!

```json
{
  "id": 914767762,
  "cliente": {          // ← CLIENTE em conta a PAGAR!
    "id": 760785271,
    "nome": "SEGURO HONDA"
  },
  "situacao": "aberto",
  "valor": 418.13
}
```

**Análise dos Dados:**
- 📊 **100% dos registros** (20/20 analisados) tinham `cliente` ao invés de `fornecedor`
- ⚠️ Esta nomenclatura é contra-intuitiva mas é assim que a API funciona
- 🐛 O transformer buscava `fornecedor.nome` que **não existia**

### 2. **Campos Opcionais Ausentes na Listagem**

Os campos abaixo não são retornados no endpoint de **listagem** (`/contas-pagar`):
- `categoria`
- `centroCusto` (ou `centro_custo`)
- `formaPagamento` (ou `forma_pagamento`)

**Resultado:** Todos retornavam `undefined`, gerando "-" na tela.

### 3. **Campo de Data Incorreto**

O transformer buscava:
- ❌ `dataEmissao` ou `data_emissao` (não existem)
- ✅ **Correto:** `data` (campo que realmente existe)

---

## ✅ **CORREÇÕES APLICADAS**

### 1. **Transformer `transformContaPagarToView`** (`lib/tiny/transformers.ts`)

#### **Antes:**
```typescript
// ❌ INCORRETO
const fornecedor = safeText(safeGet(contaObj, ["fornecedor", "nome"]));
const categoria = safeText(safeGet(contaObj, ["categoria", "nome"]) || safeGet(contaObj, "categoria"));
// ...
dataEmissao: toDate(getFirst(contaObj, ["dataEmissao", "data_emissao"])) ?? new Date(),
```

#### **Depois:**
```typescript
// ✅ CORRETO - Busca "cliente" para FORNECEDOR
const fornecedorNome = safeGet(contaObj, ["cliente", "nome"]) 
  || safeGet(contaObj, ["fornecedor", "nome"]); // fallback
const fornecedor = typeof fornecedorNome === 'string' && fornecedorNome.trim() 
  ? fornecedorNome.trim() 
  : "N/D";

// ✅ CORRETO - Aceita objeto ou string
const categoriaObj = contaObj.categoria as { descricao?: string; nome?: string } | string | undefined;
let categoria = "N/D";
if (typeof categoriaObj === 'object' && categoriaObj) {
  categoria = String(categoriaObj.descricao || categoriaObj.nome || "N/D");
} else if (typeof categoriaObj === 'string' && categoriaObj.trim()) {
  categoria = categoriaObj.trim();
}

// ✅ CORRETO - Campo "data" primeiro
dataEmissao: toDate(getFirst(contaObj, ["data", "dataEmissao", "data_emissao"])) ?? new Date(),
```

### 2. **Transformer `transformContaPagaToView`**

Aplicadas as **mesmas correções** para contas já pagas.

### 3. **Tipo TypeScript `TinyContaPagar`** (`lib/tiny/types.ts`)

Atualizado para refletir a estrutura real:

```typescript
export type TinyContaPagar = {
  id: number;
  // ✅ Campo principal é "cliente" (não "fornecedor")
  cliente?: {
    id: number;
    nome: string;
    cpfCnpj?: string;
    [key: string]: unknown;
  };
  // Mantido para compatibilidade
  fornecedor?: {
    id: number;
    nome: string;
    [key: string]: unknown;
  };
  data?: string; // ← Campo principal de emissão
  dataVencimento?: string;
  categoria?: string | { id?: number; nome?: string; descricao?: string };
  centroCusto?: string | { id?: number; nome?: string };
  formaPagamento?: string | { id?: number; nome?: string };
  // ...
}
```

---

## 📊 **RESULTADO ESPERADO**

Após resincronização completa:

| Campo | Antes | Depois |
|-------|-------|--------|
| **Fornecedor** | `-` | ✅ `SEGURO HONDA` |
| **Categoria** | `-` | ⚠️ `N/D` (se não disponível na API) |
| **Centro Custo** | `-` | ⚠️ `null` (se não disponível na API) |
| **Forma Pagto** | `-` | ⚠️ `null` (se não disponível na API) |
| **Data Emissão** | ✅ Já funcionava | ✅ Continua funcionando |
| **Status** | ✅ Já funcionava | ✅ Continua funcionando |

### ⚠️ **Limitação Conhecida**

**Categoria, Centro Custo e Forma Pagamento** podem continuar como `N/D`/`null` se:
1. A API Tiny não retorna esses campos no endpoint de listagem
2. Não há enrichment implementado (buscar detalhe de cada conta)

**Para resolver completamente:**
- Implementar enrichment igual feito em "Contas a Receber"
- Buscar `/contas-pagar/{id}` para cada conta
- Verificar se o detalhe contém esses campos

---

## 🔄 **PROCESSO DE RESYNC**

### Script Executado: `scripts/resync-contas-pagar.js`

```bash
node scripts/resync-contas-pagar.js
```

**Ações realizadas:**
1. ✅ Deletou 100 registros de `vw_contas_pagar`
2. ✅ Deletou 100 registros de `vw_contas_pagas`
3. ✅ Limpou 3.405 payloads raw
4. ✅ Resetou sync cursors

**Próximos passos:**
1. Executar sincronização completa no admin
2. Validar dados na interface

---

## 📝 **LIÇÕES APRENDIDAS**

### 1. **Nunca Assuma a Estrutura da API**
- ✅ **SEMPRE** inspecionar dados reais da API
- ❌ **NUNCA** confiar apenas na documentação ou intuição

### 2. **API Tiny ERP é Inconsistente**
- Usa `cliente` em vez de `fornecedor` para contas a pagar
- Campos podem estar em camelCase OU snake_case
- Listagem ≠ Detalhe (campos diferentes)

### 3. **Scripts de Diagnóstico são Essenciais**
- `scripts/inspect-raw-contas-pagar.js` - Analisar payloads salvos
- `scripts/check-contas-pagar-structure.js` - Estatísticas dos dados
- `scripts/inspect-contas-pagar.js` - Chamar API diretamente (se token válido)

---

## ✅ **STATUS FINAL**

- [x] Bug de `cliente` vs `fornecedor` corrigido
- [x] Campo de data de emissão corrigido
- [x] Tipos TypeScript atualizados
- [x] Transformers corrigidos (pagar + pagas)
- [x] Dados limpos e prontos para resync
- [x] Documentação completa criada

**Próxima etapa:** Validar no navegador após resincronização.

---

## 🎯 **ARQUIVOS MODIFICADOS**

1. `lib/tiny/transformers.ts`
   - `transformContaPagarToView()` - Corrigido
   - `transformContaPagaToView()` - Corrigido

2. `lib/tiny/types.ts`
   - `TinyContaPagar` - Atualizado

3. `scripts/resync-contas-pagar.js` - Criado

4. `docs/CORRECOES_CONTAS_PAGAR.md` - Este arquivo
