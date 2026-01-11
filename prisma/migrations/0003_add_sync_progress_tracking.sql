-- AlterEnum: Atualizar valores do enum SyncStatus
ALTER TYPE "SyncStatus" RENAME TO "SyncStatus_old";
CREATE TYPE "SyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELED');

-- Migrar dados existentes
ALTER TABLE "SyncRun" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SyncRun" ALTER COLUMN "status" TYPE "SyncStatus" USING (
  CASE "status"::text
    WHEN 'PENDING' THEN 'QUEUED'::SyncStatus
    WHEN 'RUNNING' THEN 'RUNNING'::SyncStatus
    WHEN 'SUCCESS' THEN 'DONE'::SyncStatus
    WHEN 'FAILED' THEN 'FAILED'::SyncStatus
    ELSE 'QUEUED'::SyncStatus
  END
);
ALTER TABLE "SyncRun" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

DROP TYPE "SyncStatus_old";

-- AlterTable: Adicionar novos campos ao SyncRun
ALTER TABLE "SyncRun" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'incremental';
ALTER TABLE "SyncRun" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "SyncRun" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "SyncRun" ADD COLUMN "currentModule" TEXT;
ALTER TABLE "SyncRun" ADD COLUMN "progressJson" JSONB;
ALTER TABLE "SyncRun" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SyncRun" RENAME COLUMN "errorMessage" TO "errorMessage";

-- Renomear startedAt se necessário (já existe)
-- ALTER TABLE "SyncRun" já tem startedAt

-- CreateTable: SyncRunLog
CREATE TABLE "SyncRunLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "module" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SyncRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncRun_companyId_createdAt_idx" ON "SyncRun"("companyId", "createdAt");
CREATE INDEX "SyncRun_companyId_status_idx" ON "SyncRun"("companyId", "status");
CREATE INDEX "SyncRunLog_runId_timestamp_idx" ON "SyncRunLog"("runId", "timestamp");
CREATE INDEX "SyncRunLog_runId_level_idx" ON "SyncRunLog"("runId", "level");

-- AddForeignKey
ALTER TABLE "SyncRunLog" ADD CONSTRAINT "SyncRunLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
