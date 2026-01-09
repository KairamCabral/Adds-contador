# Mapeamento de Campos - Portal do Contador

Este documento detalha a origem de cada campo nas views do sistema e documenta campos que são preenchidos com "N/D" ou "0" quando não disponíveis na API Tiny V3.

---

## 1. vw_vendas (Vendas)

| Campo | Origem Tiny | Notas |
|-------|-------------|-------|
| `dataHora` | `pedidos.dataPedido` | ✅ Direto da API |
| `produto` | `pedidos.itens[].descricao` | ✅ Primeiro item do pedido |
| `categoria` | - | ⚠️ **"N/D"** - API de Pedidos não retorna categoria |
| `quantidade` | `pedidos.itens[].quantidade` | ✅ Soma de todos os itens |
| `valorUnitario` | `pedidos.itens[].valorUnitario` | ✅ Média ponderada |
| `valorTotal` | `pedidos.itens[].valorUnitario * quantidade` | ✅ Calculado |
| `formaPagamento` | `pedidos.formaPagamento` | ✅ Direto da API |
| `vendedor` | `pedidos.vendedor` | ✅ Direto da API |
| `cliente` | `pedidos.nomeCliente` | ✅ Direto da API |
| `cnpjCliente` | `pedidos.cpfCnpjCliente` | ✅ Direto da API |
| `caixa` | - | ⚠️ **"N/D"** - Não disponível em Pedidos V3 |
| `status` | `pedidos.situacao` | ✅ Direto da API |

**Limitações P0:**
- **Categoria**: A API V3 `/pedidos` não retorna categoria do produto. Para obter, seria necessário fazer chamada adicional em `/produtos/{id}` para cada item, o que impactaria performance significativamente.
- **Caixa**: Conceito de "caixa" não existe no modelo Tiny V3. Pedidos são vinculados a formas de pagamento e contas bancárias.

---

## 2. vw_contas_receber_posicao (Contas a Receber - Posição)

| Campo | Origem Tiny | Notas |
|-------|-------------|-------|
| `dataEmissao` | `contas_receber.dataEmissao` | ✅ Direto da API |
| `dataVencimento` | `contas_receber.dataVencimento` | ✅ Direto da API |
| `cliente` | `contas_receber.nomeCliente` | ✅ Direto da API |
| `cnpjCliente` | `contas_receber.cpfCnpjCliente` | ✅ Direto da API |
| `numeroTitulo` | `contas_receber.numeroTitulo` | ✅ Direto da API |
| `valorOriginal` | `contas_receber.valorOriginal` | ✅ Direto da API |
| `valorPendente` | `contas_receber.valorPendente` | ✅ Direto da API |
| `status` | `contas_receber.situacao` | ✅ Direto da API |
| `diasAtraso` | Calculado: `hoje - dataVencimento` | ✅ Derivado |
| `observacoes` | `contas_receber.observacoes` | ✅ Direto da API |

**Snapshot**: Esta view usa snapshot diário (`Data_Posicao`) para congelar o saldo pendente em cada data.

---

## 3. vw_contas_pagar (Contas a Pagar)

| Campo | Origem Tiny | Notas |
|-------|-------------|-------|
| `dataEmissao` | `contas_pagar.dataEmissao` | ✅ Direto da API |
| `dataVencimento` | `contas_pagar.dataVencimento` | ✅ Direto da API |
| `fornecedor` | `contas_pagar.nomeFornecedor` | ✅ Direto da API |
| `cnpjFornecedor` | `contas_pagar.cpfCnpjFornecedor` | ✅ Direto da API |
| `numeroTitulo` | `contas_pagar.numeroTitulo` | ✅ Direto da API |
| `valorOriginal` | `contas_pagar.valorOriginal` | ✅ Direto da API |
| `valorPendente` | `contas_pagar.valorPendente` | ✅ Direto da API |
| `status` | `contas_pagar.situacao` | ✅ Direto da API |
| `diasAtraso` | Calculado: `hoje - dataVencimento` | ✅ Derivado |
| `categoria` | `contas_pagar.categoria` | ✅ Direto da API |
| `observacoes` | `contas_pagar.observacoes` | ✅ Direto da API |

---

## 4. vw_contas_recebidas (Contas Recebidas) - **P1**

| Campo | Origem Tiny | Notas |
|-------|-------------|-------|
| `dataRecebimento` | `contas_receber.baixas[].dataBaixa` | ✅ Da lista de baixas |
| `valorRecebido` | `contas_receber.baixas[].valorBaixa` | ✅ Soma das baixas |
| `juros` | `contas_receber.baixas[].juros` | ✅ Direto da API |
| `multa` | `contas_receber.baixas[].multa` | ✅ Direto da API |
| `desconto` | `contas_receber.baixas[].desconto` | ✅ Direto da API |
| `contaBancaria` | `contas_receber.baixas[].contaBancaria` | ✅ Direto da API |
| `formaPagamento` | `contas_receber.baixas[].formaPagamento` | ✅ Direto da API |
| `usuarioBaixa` | `contas_receber.baixas[].usuario` | ⚠️ **"N/D" se não disponível** |
| `comissao` | - | ⚠️ **0** - Não disponível em Contas V3 |

**Limitações P1:**
- **Usuário da Baixa**: Nem sempre retornado pela API.
- **Comissão**: Campo não existe no modelo Tiny V3 de contas. Para obter comissões reais, seria necessário integrar com módulo de Vendas/Comissionamento (fora do escopo P1).

---

## 5. vw_contas_pagas (Contas Pagas) - **P1**

| Campo | Origem Tiny | Notas |
|-------|-------------|-------|
| `dataPagamento` | `contas_pagar.baixas[].dataBaixa` | ✅ Da lista de baixas |
| `valorPago` | `contas_pagar.baixas[].valorBaixa` | ✅ Soma das baixas |
| `juros` | `contas_pagar.baixas[].juros` | ✅ Direto da API |
| `multa` | `contas_pagar.baixas[].multa` | ✅ Direto da API |
| `desconto` | `contas_pagar.baixas[].desconto` | ✅ Direto da API |
| `contaBancaria` | `contas_pagar.baixas[].contaBancaria` | ✅ Direto da API |
| `formaPagamento` | `contas_pagar.baixas[].formaPagamento` | ✅ Direto da API |
| `usuarioBaixa` | `contas_pagar.baixas[].usuario` | ⚠️ **"N/D" se não disponível** |

---

## 6. vw_estoque (Estoque) - **P2**

| Campo | Origem Tiny | Notas |
|-------|-------------|-------|
| `produto` | `produtos.nome` | ✅ Direto da API |
| `sku` | `produtos.codigo` | ✅ Direto da API |
| `categoria` | `produtos.categoria` | ✅ Direto da API |
| `estoqueInicial` | Calculado via snapshot | ⚠️ Saldo do dia anterior |
| `entradas` | Calculado via movimentações | ⚠️ Soma de entradas do dia |
| `saidas` | Calculado via movimentações | ⚠️ Soma de saídas do dia |
| `ajustes` | Calculado via movimentações | ⚠️ Soma de ajustes do dia |
| `estoqueFinal` | `produtos.estoqueAtual` | ✅ Snapshot do momento |
| `custoMedio` | `produtos.preco_custo` | ✅ Direto da API |
| `dataUltimaCompra` | - | ⚠️ **"N/D"** - Requer integração com Compras |
| `valorUltimaCompra` | - | ⚠️ **0** - Requer integração com Compras |

**Estratégia P2 (Estoque):**
1. **Snapshot Diário**: A cada sync, grava o `estoqueAtual` como `estoqueFinal` do dia.
2. **Movimentações**: Se a API Tiny V3 fornecer endpoint de movimentações, usa para calcular entradas/saídas/ajustes. Caso contrário, usa diff entre snapshots:
   - `entradas + ajustes positivos = estoqueFinal - estoqueInicial + saidas`
   - Classificar como "ajuste" quando não houver detalhes.
3. **Última Compra**: Requer chamada adicional ao módulo de Compras (se disponível).

---

## Estratégia de "N/D" e "0"

### Quando usar "N/D" (campos de texto):
- Campo **não existe** na API Tiny V3
- Campo **existe mas não é retornado** para determinado registro
- Informação **requer módulo/integração adicional** fora do escopo

### Quando usar "0" (campos numéricos):
- Valores monetários/quantidades **não disponíveis**
- Saldo/valor **zerado legitimamente** vs. **não informado**
  - Preferir `null` no banco e exibir "—" na UI quando semanticamente for "não se aplica"
  - Usar `0` quando for "zero real" (ex.: desconto = 0)

---

## Melhorias Futuras (Fora do Escopo Atual)

1. **Categorias de Produto**: Integrar com `/produtos` para enriquecer vendas com categoria real.
2. **Comissões**: Integrar com módulo de comissionamento (se Tiny disponibilizar).
3. **Movimentações Detalhadas de Estoque**: Usar endpoint específico (se disponível) em vez de diff de snapshots.
4. **Última Compra**: Integrar com módulo de Compras/Notas Fiscais de Entrada.
5. **Multi-empresa**: Quando houver mais de uma empresa, ativar o seletor de empresa.

---

**Última Atualização**: 2026-01-08  
**Responsável**: Tech Lead - Portal do Contador

