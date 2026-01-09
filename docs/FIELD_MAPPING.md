# Mapeamento de Campos - Portal do Contador → Tiny API V3

## Legenda
- ✅ **Implementado e funcionando**
- ⚠️ **Implementado parcialmente** (falta enrichment)
- ❌ **Não implementado** (usar fallback)
- 🔍 **Requer investigação** (verificar Swagger)

---

## 1. vw_vendas (Pedidos)

| Campo Planilha | Endpoint Tiny | Path API | Status | Fallback | Notas |
|----------------|---------------|----------|--------|----------|-------|
| DataHora | `/pedidos/{id}` | `.data_pedido` | ✅ OK | - | |
| Produto | `/pedidos/{id}` | `.itens[].descricao` | ❌ FALHA | "N/D" | Detalhe não está sendo buscado |
| Categoria | `/produtos/{id}` | `.categoria.nome` | ❌ FALTA | "N/D" | Requer enrichment |
| Quantidade | `/pedidos/{id}` | `.itens[].quantidade` | ⚠️ OK | 1 | Detalhe não está sendo buscado |
| Valor_Unitario | `/pedidos/{id}` | `.itens[].valor_unitario` | ❌ ZERO | 0 | Detalhe não está sendo buscado |
| Valor_Total | `/pedidos/{id}` | `.itens[].valor_total` | ❌ ZERO | 0 | Detalhe não está sendo buscado |
| Forma_Pagamento | `/pedidos/{id}` | `.forma_pagamento.nome` | ❌ FALTA | "N/D" | Requer enrichment |
| Vendedor | `/pedidos/{id}` | `.vendedor.nome` | ❌ FALTA | "N/D" | Campo existe mas não mapeado |
| Cliente | `/pedidos/{id}` | `.cliente.nome` | ✅ OK | - | |
| CNPJ_Cliente | `/pessoas/{id}` | `.cpf_cnpj` | ❌ FALTA | "N/D" | Requer enrichment |
| Caixa | - | - | ❌ N/A | "N/D" | Não existe na Tiny V3 |
| Status | `/pedidos/{id}` | `.situacao` | ⚠️ NUM | "aprovado" | Mapear código → texto |

### Ações Necessárias:
1. **CRÍTICO**: Implementar `getPedido` corretamente (buscar detalhes com itens)
2. Criar cache de produtos (id → categoria)
3. Criar cache de pessoas (id → CNPJ)
4. Mapear códigos de status (enum)
5. Investigar se existe campo "vendedor" no pedido

---

## 2. vw_contas_receber_posicao (Contas a Receber)

| Campo Planilha | Endpoint Tiny | Path API | Status | Fallback | Notas |
|----------------|---------------|----------|--------|----------|-------|
| ID_Titulo | `/contas-receber` | `.id` | ✅ OK | - | |
| Cliente | `/contas-receber` | `.cliente.nome` | ✅ OK | - | |
| CNPJ | `/pessoas/{id}` | `.cpf_cnpj` | ❌ FALTA | "N/D" | Requer enrichment |
| Categoria | `/contas-receber` | `.categoria.nome` | ❌ FALTA | "N/D" | Requer enrichment |
| CentroCusto | `/contas-receber` | `.centro_custo.nome` | ⚠️ NULL | null | Mapear se existir |
| Data_Emissao | `/contas-receber` | `.data_emissao` | ✅ OK | - | |
| Data_Vencimento | `/contas-receber` | `.data_vencimento` | ✅ OK | - | |
| Valor | `/contas-receber` | `.valor` | ✅ OK | - | |
| Data_Posição | - | - | ✅ OK | hoje | Gerado pelo sistema |

### Ações Necessárias:
1. Criar cache de pessoas (id → CNPJ)
2. Mapear categoria (se vier como objeto com `.nome`)
3. Mapear centro_custo (se vier como objeto com `.nome`)

---

## 3. vw_contas_pagar (Contas a Pagar)

| Campo Planilha | Endpoint Tiny | Path API | Status | Fallback | Notas |
|----------------|---------------|----------|--------|----------|-------|
| ID_Titulo | `/contas-pagar` | `.id` | ✅ OK | - | |
| Fornecedor | `/contas-pagar` | `.fornecedor.nome` | ❌ FALTA | "N/D" | Requer enrichment |
| Categoria | `/contas-pagar` | `.categoria.nome` | ❌ FALTA | "N/D" | Requer enrichment |
| CentroCusto | `/contas-pagar` | `.centro_custo.nome` | ⚠️ NULL | null | Mapear se existir |
| Data_Emissao | `/contas-pagar` | `.data_emissao` | ✅ OK | - | |
| Data_Vencimento | `/contas-pagar` | `.data_vencimento` | ✅ OK | - | |
| Valor | `/contas-pagar` | `.valor` | ✅ OK | - | |
| Status | `/contas-pagar` | `.situacao` | ✅ OK | - | |
| FormaPagto | `/contas-pagar` | `.forma_pagamento.nome` | ⚠️ NULL | null | Mapear se existir |

### Ações Necessárias:
1. Mapear fornecedor (se vier como objeto com `.nome`)
2. Mapear categoria (se vier como objeto com `.nome`)
3. Mapear forma_pagamento (se vier como objeto com `.nome`)

---

## 4. vw_contas_recebidas (Baixas de Contas a Receber) - P1

| Campo Planilha | Endpoint Tiny | Path API | Status | Fallback | Notas |
|----------------|---------------|----------|--------|----------|-------|
| ID_Titulo | 🔍 | 🔍 | ❌ P1 | - | Investigar endpoint de baixas |
| Data_Recebimento | 🔍 | 🔍 | ❌ P1 | - | |
| Valor_Recebido | 🔍 | 🔍 | ❌ P1 | - | |
| Desconto | 🔍 | 🔍 | ❌ P1 | 0 | |
| Juros | 🔍 | 🔍 | ❌ P1 | 0 | |
| Multa | 🔍 | 🔍 | ❌ P1 | 0 | |
| Comissão cartão | - | - | ❌ N/A | 0 | Não existe na Tiny V3 |
| Comissão mktplaces | - | - | ❌ N/A | 0 | Não existe na Tiny V3 |
| Conta_Bancaria | 🔍 | 🔍 | ❌ P1 | "N/D" | |
| Usuario_Baixa | 🔍 | 🔍 | ❌ P1 | "N/D" | |

### Ações Necessárias:
1. **Verificar Swagger**: Existe endpoint `/contas-receber/{id}/baixas` ou similar?
2. Se não existir endpoint específico, verificar se baixas vêm dentro do detalhe da conta
3. Documentar campos sem fonte oficial (comissões)

---

## 5. vw_contas_pagas (Baixas de Contas a Pagar) - P1

Estrutura similar a `vw_contas_recebidas`. Mesmas ações necessárias.

---

## 6. vw_estoque (Snapshot de Estoque) - P2

| Campo Planilha | Endpoint Tiny | Path API | Status | Fallback | Notas |
|----------------|---------------|----------|--------|----------|-------|
| Data_Referencia | - | - | ✅ OK | hoje | Gerado pelo sistema |
| Produto | `/produtos` | `.descricao` | ❌ P2 | - | |
| Categoria | `/produtos` | `.categoria.nome` | ❌ P2 | "N/D" | |
| Estoque_Final | `/produtos/{id}/estoque` | `.saldo` | ❌ P2 | 0 | Verificar endpoint |
| Custo_Medio | `/produtos/{id}` | `.custo_medio` | ❌ P2 | 0 | Verificar se existe |
| Valor_Total_Estoque | - | - | ❌ P2 | 0 | Calculado: saldo × custo |
| Entradas/Saidas/Ajustes | 🔍 | 🔍 | ❌ P2 | 0 | Calcular por diff snapshots |
| Fornecedor_Ultima_Compra | 🔍 | 🔍 | ❌ P2 | "N/D" | Investigar endpoint compras |

### Ações Necessárias:
1. Implementar snapshot diário com cron
2. Verificar endpoints: `/produtos`, `/produtos/{id}/estoque`, `/movimentacoes`
3. Calcular campos derivados (valor total, diff)

---

## Próximos Passos

### Prioridade P0 (Crítico):
1. ✅ Corrigir `getPedido` para buscar detalhes com itens
2. ✅ Implementar transformação correta de itens → vendas
3. ✅ Mapear status de pedidos (código → texto)
4. ✅ Implementar enrichment básico (categorias, CNPJ)

### Prioridade P1:
- Implementar contas recebidas/pagas (baixas)

### Prioridade P2:
- Implementar vw_estoque (snapshot)


