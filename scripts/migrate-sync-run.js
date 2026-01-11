/**
 * Script para migrar dados do SyncRun antes de alterar o schema
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('[Migrate] Iniciando migração do SyncRun...');

  // 1. Atualizar status antigos para novos valores
  const updated = await prisma.$executeRaw`
    UPDATE "SyncRun" 
    SET status = CASE 
      WHEN status::text = 'PENDING' THEN 'QUEUED'
      WHEN status::text = 'SUCCESS' THEN 'DONE'
      ELSE status::text
    END::text::"SyncStatus"
    WHERE status::text IN ('PENDING', 'SUCCESS')
  `;

  console.log(`[Migrate] ${updated} registros atualizados`);

  // 2. Verificar se ainda existem valores antigos
  const remaining = await prisma.$queryRaw`
    SELECT status::text, COUNT(*) as count
    FROM "SyncRun"
    GROUP BY status::text
  `;

  console.log('[Migrate] Status atuais:', remaining);

  console.log('[Migrate] Migração concluída!');
}

main()
  .catch((e) => {
    console.error('[Migrate] Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
