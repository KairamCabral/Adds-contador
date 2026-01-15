-- ============================================
-- LIMPAR DADOS SINCRONIZADOS (MANTER USUÁRIOS E CONFIGURAÇÕES)
-- ============================================
-- Execute este script para limpar todos os dados
-- sincronizados e forçar uma nova sincronização completa
--
-- ⚠️ ATENÇÃO: Isso irá apagar:
--   - Todas as vendas
--   - Todas as contas a receber/pagar/pagas/recebidas
--   - Todo o estoque
--   - Cache de produtos
--   - Histórico de sincronizações
--
-- ✅ NÃO será apagado:
--   - Usuários
--   - Conexões Tiny (tokens OAuth)
--   - Configurações da empresa
-- ============================================

-- Início da transação
BEGIN;

-- 1. Limpar views de relatórios
DELETE FROM "VwVendas";
DELETE FROM "VwContasReceberPosicao";
DELETE FROM "VwContasPagar";
DELETE FROM "VwContasPagas";
DELETE FROM "VwContasRecebidas";
DELETE FROM "VwEstoque";

-- 2. Limpar cache de produtos (será recriado no próximo sync)
DELETE FROM "TinyProdutoCache";

-- 3. Limpar histórico de sincronizações
DELETE FROM "SyncRun";

-- Confirmar alterações
COMMIT;

-- Mostrar estatísticas após limpeza
SELECT 
  'VwVendas' as tabela, 
  COUNT(*) as registros 
FROM "VwVendas"

UNION ALL

SELECT 
  'VwContasReceberPosicao', 
  COUNT(*) 
FROM "VwContasReceberPosicao"

UNION ALL

SELECT 
  'VwContasPagar', 
  COUNT(*) 
FROM "VwContasPagar"

UNION ALL

SELECT 
  'VwContasPagas', 
  COUNT(*) 
FROM "VwContasPagas"

UNION ALL

SELECT 
  'VwContasRecebidas', 
  COUNT(*) 
FROM "VwContasRecebidas"

UNION ALL

SELECT 
  'VwEstoque', 
  COUNT(*) 
FROM "VwEstoque"

UNION ALL

SELECT 
  'TinyProdutoCache', 
  COUNT(*) 
FROM "TinyProdutoCache"

UNION ALL

SELECT 
  'SyncRun', 
  COUNT(*) 
FROM "SyncRun";

-- Mostrar configurações mantidas
SELECT 
  'Usuários mantidos' as info, 
  COUNT(*)::text as valor 
FROM "User"

UNION ALL

SELECT 
  'Empresas mantidas', 
  COUNT(*)::text 
FROM "Company"

UNION ALL

SELECT 
  'Conexões Tiny mantidas', 
  COUNT(*)::text 
FROM "TinyConnection";
