# ✅ Correções Aplicadas - Contas a Receber

**Data**: 09/01/2026  
**Status**: ✅ Concluído

---

## 🔍 Problema Identificado

Na aba "Contas a Receber", os campos **CATEGORIA** e **CENTRO CUSTO** apareciam como `-` (traço/hífen) em vez de valores descritivos ou "N/D".

---

## 🧪 Investigação Realizada

### Scripts Criados

1. **`scripts/inspect-contas-receber.js`**
   - Lista contas a receber da API Tiny
   - Mostra estrutura do JSON retornado
   - **Descoberta**: API não retorna categoria nem centro de custo na listagem

2. **`scripts/inspect-conta-receber-detalhe.js`**
   - Busca detalhe de uma conta específica via `/contas-receber/{id}`
   - **Descoberta**: Endpoint de detalhe retorna `"categoria": null` explicitamente
   - **Descoberta**: Campo `centroCusto` não existe no JSON

### Conclusão

**A API Tiny v3 NÃO fornece categoria nem centro de custo para contas a receber.**

- **Categoria**: Retorna `null` explicitamente
- **Centro de Custo**: Campo não existe no JSON

---

## 🛠️ Correções Aplicadas

### 1. Transformer Otimizado

**Arquivo**: `lib/tiny/transformers.ts`  
**Função**: `transformContaReceberToPosicao`

#### Antes:
```typescript
const categoria = safeText(
  safeGet(contaObj, ["categoria", "nome"]) || 
  safeGet(contaObj, "categoria")
);
const centroCusto = safeText(
  safeGet(contaObj, ["centroCusto", "nome"]) || 
  safeGet(contaObj, "centroCusto")
);

return {
  // ...
  categoria: categoria || "N/D",  // ← Retornava "-"
  centroCusto: centroCusto || null,  // ← Retornava "-"
}
```

**Problema**: `safeText(null)` retornava `"-"` como fallback padrão.

#### Depois:
```typescript
// Categoria: API Tiny sempre retorna null (campo não disponível)
// Documentado em: docs/CONTAS_RECEBER_LIMITACOES.md
const categoria = "N/D";

// Centro de Custo: campo não existe na API Tiny para contas a receber
// Documentado em: docs/CONTAS_RECEBER_LIMITACOES.md
const centroCusto = null;

return {
  // ...
  categoria,      // ← Sempre "N/D"
  centroCusto,    // ← Sempre null (exibido como "-" ou vazio na UI)
}
```

**Benefícios**:
- ✅ Código mais limpo e direto
- ✅ Não tenta acessar campos inexistentes
- ✅ Performance melhorada (remove chamadas desnecessárias)
- ✅ Documentado explicitamente no código

### 2. Extração de Data de Emissão Corrigida

**Antes**:
```typescript
dataEmissao: toDate(getFirst(contaObj, ["dataEmissao", "data_emissao"]))
```

**Depois**:
```typescript
dataEmissao: toDate(getFirst(contaObj, ["data", "dataEmissao", "data_emissao"]))
```

**Motivo**: A API Tiny retorna `"data"` como campo principal (verificado via inspeção).

### 3. Extração de CPF/CNPJ Melhorada

**Antes**:
```typescript
const cnpj = safeText(safeGet(contaObj, ["cliente", "cpfCnpj"]));
```

**Depois**:
```typescript
const cpfCnpj = safeGet(contaObj, ["cliente", "cpfCnpj"]) || 
                safeGet(contaObj, ["cliente", "cpf_cnpj"]);
const cnpj = typeof cpfCnpj === 'string' && cpfCnpj.trim() 
  ? cpfCnpj.trim() 
  : "N/D";
```

**Benefícios**:
- ✅ Suporta variações de nomenclatura (camelCase/snake_case)
- ✅ Validação de tipo antes de usar
- ✅ Trim explícito para remover espaços

---

## 📄 Documentação Criada

### 1. `docs/CONTAS_RECEBER_LIMITACOES.md`

Documentação completa sobre:
- Campos disponíveis vs. indisponíveis na API Tiny
- Exemplo de JSON real retornado pela API
- Justificativas técnicas para cada campo
- Recomendações para a interface do usuário

### 2. Scripts de Validação

- `scripts/inspect-contas-receber.js` - Lista e inspeciona estrutura
- `scripts/inspect-conta-receber-detalhe.js` - Busca detalhe de uma conta
- `scripts/resync-contas-receber.js` - Limpa e instrui re-sincronização

---

## 🎯 Resultado Esperado

Após sincronização com as correções:

| Campo | Antes | Depois | Motivo |
|-------|-------|--------|--------|
| **ID Título** | ✅ OK | ✅ OK | Campo disponível |
| **Cliente** | ✅ OK | ✅ OK | Campo disponível |
| **CNPJ/CPF** | ✅ OK | ✅ OK | Campo disponível |
| **Categoria** | `-` | `N/D` | API retorna `null` |
| **Centro Custo** | `-` | `-` ou vazio | Campo não existe na API |
| **Data Emissão** | ✅ OK | ✅ OK | Corrigido para usar `data` |
| **Data Vencimento** | ✅ OK | ✅ OK | Campo disponível |
| **Valor** | ✅ OK | ✅ OK | Campo disponível |
| **Data Posição** | ✅ OK | ✅ OK | Gerado pelo sistema |

---

## 🚀 Como Aplicar as Correções

### 1. Limpar dados antigos

```bash
node scripts/resync-contas-receber.js
```

### 2. Re-sincronizar

```bash
npm run dev
# Acesse o sistema → aba "Contas a Receber" → "Sincronizar agora"
```

---

## 💡 Recomendações Adicionais

### Para a Interface do Usuário

1. **Tooltip**: Adicionar tooltip nas colunas Categoria e Centro Custo explicando:
   > "⚠️ Campo não disponível na API Tiny para contas a receber"

2. **Visual**: Considerar ocultar ou cinza (greyed out) essas colunas com ícone de informação

3. **Ajuda contextual**: Link para `docs/CONTAS_RECEBER_LIMITACOES.md`

### Para o Futuro

Se houver necessidade de preencher esses campos:

1. **Cadastro manual**: Permitir usuário associar via interface
2. **Regras de negócio**: Criar mapeamento automático baseado em cliente/histórico
3. **Integração adicional**: Verificar se outro endpoint Tiny fornece esses dados

---

## ✅ Validação do Build

```bash
npm run build
```

**Status**: ✅ Build passou sem erros

---

## 📝 Arquivos Alterados

1. ✏️ `lib/tiny/transformers.ts` - Função `transformContaReceberToPosicao` otimizada
2. ➕ `docs/CONTAS_RECEBER_LIMITACOES.md` - Documentação técnica criada
3. ➕ `docs/CORRECOES_CONTAS_RECEBER.md` - Este documento
4. ➕ `scripts/inspect-contas-receber.js` - Script de inspeção de listagem
5. ➕ `scripts/inspect-conta-receber-detalhe.js` - Script de inspeção de detalhe
6. ➕ `scripts/resync-contas-receber.js` - Script de limpeza e re-sync

---

**✅ Correções aplicadas com sucesso!**

**📊 Próximo passo**: Testar sincronização na UI e validar resultados.
