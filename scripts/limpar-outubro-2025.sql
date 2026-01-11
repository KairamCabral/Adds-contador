-- Limpar dados de Outubro 2025
-- Execute este script no banco de dados para remover todos os dados sincronizados de outubro/2025

BEGIN;

-- Limpar Vendas
DELETE FROM "VwVendas" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataHora" >= '2025-10-01T00:00:00.000Z'
  AND "dataHora" <= '2025-10-31T23:59:59.999Z';

-- Limpar Contas a Receber (Posição)
DELETE FROM "VwContasReceberPosicao" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataVencimento" >= '2025-10-01'
  AND "dataVencimento" <= '2025-10-31';

-- Limpar Contas a Pagar
DELETE FROM "VwContasPagar" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataVencimento" >= '2025-10-01'
  AND "dataVencimento" <= '2025-10-31';

-- Limpar Contas Pagas
DELETE FROM "VwContasPagas" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataPagamento" >= '2025-10-01'
  AND "dataPagamento" <= '2025-10-31';

-- Limpar Contas Recebidas
DELETE FROM "VwContasRecebidas" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataRecebimento" >= '2025-10-01'
  AND "dataRecebimento" <= '2025-10-31';

-- Estoque é snapshot, não precisa limpar por data

-- Limpar RawApiPayload (opcional - dados brutos)
DELETE FROM "RawApiPayload"
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "createdAt" >= '2025-10-01T00:00:00.000Z'
  AND "createdAt" <= '2025-10-31T23:59:59.999Z';

COMMIT;

-- Verificar resultados
SELECT 
  'Vendas' as tabela,
  COUNT(*) as registros
FROM "VwVendas" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataHora" >= '2025-10-01T00:00:00.000Z'
  AND "dataHora" <= '2025-10-31T23:59:59.999Z'
UNION ALL
SELECT 
  'Contas a Receber' as tabela,
  COUNT(*) as registros
FROM "VwContasReceberPosicao" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataVencimento" >= '2025-10-01'
  AND "dataVencimento" <= '2025-10-31'
UNION ALL
SELECT 
  'Contas a Pagar' as tabela,
  COUNT(*) as registros
FROM "VwContasPagar" 
WHERE "companyId" = '89697d08-9711-4cc2-808e-1ca4704aa36c'
  AND "dataVencimento" >= '2025-10-01'
  AND "dataVencimento" <= '2025-10-31';
