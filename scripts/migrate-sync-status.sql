-- Migração segura do SyncStatus

-- 1. Atualizar valores existentes para os novos antes de alterar o enum
UPDATE "SyncRun" SET status = 'QUEUED' WHERE status = 'PENDING';
UPDATE "SyncRun" SET status = 'DONE' WHERE status = 'SUCCESS';

-- 2. Agora o db push pode rodar sem erro
