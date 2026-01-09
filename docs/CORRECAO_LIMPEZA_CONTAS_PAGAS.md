# 🧹 Correção: Limpeza Automática de Contas Pagas/Recebidas

## 📅 Data: 09/01/2026

---

## 🎯 **PROBLEMA IDENTIFICADO**

### Cenário

Quando uma conta muda de status no Tiny ERP:

**ANTES da correção:**

```
1. Conta criada → Status: ABERTO
   ✅ Inserida em vw_contas_pagar

2. Conta paga no Tiny → Status: PAGO
   ✅ Inserida em vw_contas_pagas
   ❌ PERMANECE em vw_contas_pagar

3. RESULTADO:
   🚨 Conta aparece em AMBAS as tabelas!
   🚨 Duplicação de dados
   🚨 Relatórios incorretos
```

### Impacto

- ❌ Contas aparecem duplicadas em diferentes abas
- ❌ Soma total de valores fica incorreta
- ❌ Usuário não sabe qual aba consultar
- ❌ Possível confusão: "Essa conta está paga ou não?"

---

## ✅ **SOLUÇÃO IMPLEMENTADA**

### Lógica de Limpeza Automática

**DEPOIS da correção:**

```
1. syncContasPagas() processa contas pagas
   ├─ Insere/atualiza em vw_contas_pagas
   └─ 🧹 REMOVE de vw_contas_pagar (limpeza automática)

2. syncContasRecebidas() processa contas recebidas
   ├─ Insere/atualiza em vw_contas_recebidas
   └─ 🧹 REMOVE de vw_contas_receber_posicao (limpeza automática)
```

### Código Implementado

#### 1. Contas a Pagar → Contas Pagas

```typescript
// jobs/sync.ts - syncContasPagas()

const titulosProcessados: bigint[] = [];

for (const conta of contas) {
  // ... inserir em vw_contas_pagas ...
  titulosProcessados.push(contaView.tituloId);
}

// LIMPEZA: Remover de vw_contas_pagar as contas que foram pagas
if (titulosProcessados.length > 0) {
  const deleted = await prisma.vwContasPagar.deleteMany({
    where: {
      companyId,
      tituloId: { in: titulosProcessados },
    },
  });
  
  if (deleted.count > 0) {
    console.log(`[Sync] 🧹 Removidas ${deleted.count} contas pagas de vw_contas_pagar`);
  }
}
```

#### 2. Contas a Receber → Contas Recebidas

```typescript
// jobs/sync.ts - syncContasRecebidas()

const titulosProcessados: bigint[] = [];

for (const conta of contas) {
  // ... inserir em vw_contas_recebidas ...
  titulosProcessados.push(contaView.tituloId);
}

// LIMPEZA: Remover de vw_contas_receber_posicao as contas que foram recebidas
if (titulosProcessados.length > 0) {
  const deleted = await prisma.vwContasReceberPosicao.deleteMany({
    where: {
      companyId,
      tituloId: { in: titulosProcessados },
    },
  });
  
  if (deleted.count > 0) {
    console.log(`[Sync] 🧹 Removidas ${deleted.count} contas recebidas de vw_contas_receber_posicao`);
  }
}
```

---

## 📊 **COMPORTAMENTO ESPERADO**

### Fluxo Completo: Contas a Pagar

| Momento | Status no Tiny | vw_contas_pagar | vw_contas_pagas |
|---------|----------------|-----------------|-----------------|
| T0: Conta criada | `aberto` | ✅ Presente | ❌ Ausente |
| T1: Usuário paga no Tiny | `pago` | ✅ Presente* | ❌ Ausente |
| T2: Sync executado | `pago` | ❌ **REMOVIDA** 🧹 | ✅ **ADICIONADA** |

*Até a próxima sincronização

### Fluxo Completo: Contas a Receber

| Momento | Status no Tiny | vw_contas_receber_posicao | vw_contas_recebidas |
|---------|----------------|---------------------------|---------------------|
| T0: Conta criada | `aberto` | ✅ Presente | ❌ Ausente |
| T1: Cliente paga | `pago` | ✅ Presente* | ❌ Ausente |
| T2: Sync executado | `pago` | ❌ **REMOVIDA** 🧹 | ✅ **ADICIONADA** |

*Até a próxima sincronização

---

## 🎯 **BENEFÍCIOS**

### 1. **Dados Consistentes**
- ✅ Cada conta aparece em apenas UMA aba
- ✅ Status reflete a realidade do Tiny ERP

### 2. **Relatórios Corretos**
- ✅ Soma de valores a pagar: apenas contas abertas
- ✅ Soma de valores pagos: apenas contas pagas
- ✅ Sem duplicação de valores

### 3. **UX Melhor**
- ✅ Usuário sabe onde procurar cada conta
- ✅ Contas a Pagar = só abertas
- ✅ Contas Pagas = só pagas

### 4. **Sincronização Automática**
- ✅ Nenhuma ação manual necessária
- ✅ Limpeza acontece automaticamente a cada sync
- ✅ Sistema se auto-corrige

---

## 🧪 **TESTES**

### Cenário de Teste 1: Pagar Conta

```bash
1. Execute sync inicial
   → Verificar: conta aparece em "Contas a Pagar"

2. No Tiny ERP: marque a conta como paga

3. Execute sync novamente

4. VALIDAR:
   ✅ Conta DESAPARECE de "Contas a Pagar"
   ✅ Conta APARECE em "Contas Pagas"
   ✅ Logs mostram: "🧹 Removidas X contas pagas de vw_contas_pagar"
```

### Cenário de Teste 2: Receber Conta

```bash
1. Execute sync inicial
   → Verificar: conta aparece em "Contas a Receber"

2. No Tiny ERP: marque a conta como recebida

3. Execute sync novamente

4. VALIDAR:
   ✅ Conta DESAPARECE de "Contas a Receber"
   ✅ Conta APARECE em "Contas Recebidas"
   ✅ Logs mostram: "🧹 Removidas X contas recebidas de vw_contas_receber_posicao"
```

---

## 🔍 **MONITORAMENTO**

### Logs de Limpeza

Quando a limpeza acontecer, você verá nos logs:

```
[Sync vw_contas_pagas] Processando 5 contas pagas
[Sync vw_contas_pagas] 🧹 Removidas 5 contas pagas de vw_contas_pagar
```

### Script de Verificação

Use o script para verificar se há duplicação:

```bash
node scripts/check-sync-logic.js
```

O script mostra:
- Quantas contas em cada tabela
- Se há duplicação (mesmo tituloId em ambas)
- Lista de contas duplicadas (se houver)

---

## ⚠️ **CONSIDERAÇÕES**

### 1. **Contas Canceladas**

Se uma conta for cancelada no Tiny (status = `cancelado`):
- ⚠️ Ela permanece em `vw_contas_pagar` até ser manualmente removida
- 💡 **Melhoria futura:** Adicionar limpeza para contas canceladas

### 2. **Contas Vencidas**

Contas vencidas mas não pagas:
- ✅ Permanecem em `vw_contas_pagar` (correto)
- 💡 O campo `status` pode ser atualizado para mostrar "vencido"

### 3. **Performance**

- ✅ Limpeza usa `deleteMany` com `IN` (eficiente)
- ✅ Apenas títulos processados são limpos
- ✅ Zero impacto em sincronizações sem contas pagas

---

## 📝 **ARQUIVOS MODIFICADOS**

1. `jobs/sync.ts`
   - `syncContasPagas()` - Adicionada lógica de limpeza
   - `syncContasRecebidas()` - Adicionada lógica de limpeza

2. `scripts/check-sync-logic.js` (novo)
   - Script para verificar duplicação

3. `docs/CORRECAO_LIMPEZA_CONTAS_PAGAS.md` (este arquivo)
   - Documentação completa da correção

---

## ✅ **VALIDAÇÃO**

### Checklist de Validação

Após próxima sincronização, verifique:

- [ ] Executar sincronização completa
- [ ] Verificar logs: aparecem mensagens "🧹 Removidas..."
- [ ] Conferir "Contas a Pagar": só contas abertas
- [ ] Conferir "Contas Pagas": só contas pagas
- [ ] Executar `node scripts/check-sync-logic.js`
- [ ] Confirmar: zero duplicados encontrados

---

## 🎉 **CONCLUSÃO**

Com essa correção, o sistema agora:

✅ **Reflete corretamente o status** das contas no Tiny ERP  
✅ **Evita duplicação** entre abas  
✅ **Mantém dados consistentes** automaticamente  
✅ **Melhora a UX** - cada conta está onde deveria estar  

**Sistema funcionando como o usuário espera!** 🚀
