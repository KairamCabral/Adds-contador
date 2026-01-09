-- Script para limpar dados problemáticos de vw_vendas
-- Execute este script antes de fazer um novo sync

BEGIN;

-- Mostrar estatísticas antes da limpeza
SELECT 
  'ANTES DA LIMPEZA' as momento,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN "Produto" LIKE '%undefined%' THEN 1 END) as com_undefined,
  COUNT(CASE WHEN "Categoria" = 'N/D' THEN 1 END) as categoria_nd,
  COUNT(CASE WHEN "Forma_Pagamento" = 'N/D' THEN 1 END) as forma_pagto_nd
FROM vw_vendas;

-- Deletar registros com "Pedido #undefined"
DELETE FROM vw_vendas 
WHERE "Produto" LIKE '%undefined%';

-- Opcional: deletar TODOS os registros para começar limpo
-- Descomente a linha abaixo se quiser limpar tudo:
-- DELETE FROM vw_vendas;

-- Mostrar estatísticas após a limpeza
SELECT 
  'DEPOIS DA LIMPEZA' as momento,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN "Produto" LIKE '%undefined%' THEN 1 END) as com_undefined,
  COUNT(CASE WHEN "Categoria" = 'N/D' THEN 1 END) as categoria_nd,
  COUNT(CASE WHEN "Forma_Pagamento" = 'N/D' THEN 1 END) as forma_pagto_nd
FROM vw_vendas;

COMMIT;

-- Para reverter se necessário, execute: ROLLBACK;
