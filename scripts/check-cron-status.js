/**
 * Script para verificar status de sincronizações automáticas (cron)
 * 
 * Uso:
 *   node scripts/check-cron-status.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 VERIFICANDO STATUS DO CRON DE SINCRONIZAÇÃO\n');
  console.log('=' .repeat(80));
  
  // 1. Verificar variável CRON_SECRET
  console.log('\n1️⃣  VERIFICANDO VARIÁVEL CRON_SECRET');
  console.log('-'.repeat(80));
  const hasCronSecret = !!process.env.CRON_SECRET;
  console.log(`   Status: ${hasCronSecret ? '✅ Configurada' : '❌ NÃO CONFIGURADA'}`);
  if (!hasCronSecret) {
    console.log('   ⚠️  PROBLEMA: CRON_SECRET não está definida!');
    console.log('   💡 Solução: Adicione a variável no painel da Vercel');
    console.log('   🔗 https://vercel.com/dashboard → Settings → Environment Variables');
  }
  
  // 2. Verificar empresas com conexão Tiny
  console.log('\n2️⃣  VERIFICANDO EMPRESAS COM CONEXÃO TINY');
  console.log('-'.repeat(80));
  const companies = await prisma.company.findMany({
    include: {
      connections: {
        where: {
          expiresAt: {
            gt: new Date(), // Somente conexões válidas
          },
        },
        take: 1,
      },
    },
  });
  
  const companiesWithConnection = companies.filter(c => c.connections.length > 0);
  
  console.log(`   Total de empresas: ${companies.length}`);
  console.log(`   Com conexão Tiny válida: ${companiesWithConnection.length}`);
  
  if (companiesWithConnection.length === 0) {
    console.log('   ⚠️  PROBLEMA: Nenhuma empresa tem conexão Tiny válida!');
    console.log('   💡 Solução: Conecte ao Tiny em /admin/conexoes-tiny');
  } else {
    console.log('\n   Empresas configuradas:');
    for (const company of companiesWithConnection) {
      const conn = company.connections[0];
      const daysUntilExpire = Math.floor(
        (conn.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      console.log(`   - ${company.name} (expira em ${daysUntilExpire} dias)`);
    }
  }
  
  // 3. Verificar últimas sincronizações (últimas 24h)
  console.log('\n3️⃣  VERIFICANDO ÚLTIMAS SINCRONIZAÇÕES (ÚLTIMAS 24H)');
  console.log('-'.repeat(80));
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const recentSyncs = await prisma.syncRun.findMany({
    where: {
      startedAt: {
        gte: last24h,
      },
    },
    include: {
      company: true,
    },
    orderBy: {
      startedAt: 'desc',
    },
    take: 10,
  });
  
  if (recentSyncs.length === 0) {
    console.log('   ❌ NENHUMA sincronização nas últimas 24 horas!');
    console.log('   ⚠️  PROBLEMA: O cron não está executando');
  } else {
    console.log(`   Total de sincronizações: ${recentSyncs.length}\n`);
    
    for (const sync of recentSyncs) {
      const status = sync.status === 'COMPLETED' ? '✅' : 
                     sync.status === 'FAILED' ? '❌' : 
                     sync.status === 'RUNNING' ? '⏳' : '⚠️';
      
      const duration = sync.finishedAt 
        ? `${Math.round((sync.finishedAt.getTime() - sync.startedAt.getTime()) / 1000)}s`
        : 'Em execução';
      
      console.log(`   ${status} ${sync.company.name}`);
      console.log(`      Início: ${sync.startedAt.toLocaleString('pt-BR')}`);
      console.log(`      Status: ${sync.status}`);
      console.log(`      Duração: ${duration}`);
      
      if (sync.errorMessage) {
        console.log(`      ❌ Erro: ${sync.errorMessage.substring(0, 100)}...`);
      }
      
      if (sync.stats && Array.isArray(sync.stats)) {
        const totalProcessed = sync.stats.reduce((sum, s) => {
          return sum + (s.processed || 0);
        }, 0);
        console.log(`      Registros processados: ${totalProcessed}`);
      }
      
      console.log('');
    }
  }
  
  // 4. Verificar próxima execução esperada do cron (3h da manhã)
  console.log('\n4️⃣  PRÓXIMA EXECUÇÃO ESPERADA DO CRON');
  console.log('-'.repeat(80));
  const now = new Date();
  const today3am = new Date(now);
  today3am.setHours(3, 0, 0, 0);
  
  const tomorrow3am = new Date(today3am);
  tomorrow3am.setDate(tomorrow3am.getDate() + 1);
  
  const nextRun = now < today3am ? today3am : tomorrow3am;
  const hoursUntil = Math.round((nextRun.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  console.log(`   Próxima execução: ${nextRun.toLocaleString('pt-BR')}`);
  console.log(`   Em: ${hoursUntil} horas`);
  
  // 5. Verificar última sincronização de cada empresa
  console.log('\n5️⃣  ÚLTIMA SINCRONIZAÇÃO POR EMPRESA');
  console.log('-'.repeat(80));
  
  for (const company of companiesWithConnection) {
    const lastSync = await prisma.syncRun.findFirst({
      where: {
        companyId: company.id,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
    
    if (lastSync) {
      const hoursAgo = Math.round((Date.now() - lastSync.startedAt.getTime()) / (1000 * 60 * 60));
      const status = lastSync.status === 'COMPLETED' ? '✅' : 
                     lastSync.status === 'FAILED' ? '❌' : '⚠️';
      
      console.log(`   ${status} ${company.name}`);
      console.log(`      Última sync: há ${hoursAgo}h (${lastSync.startedAt.toLocaleString('pt-BR')})`);
      console.log(`      Status: ${lastSync.status}`);
      
      if (hoursAgo > 26) {
        console.log(`      ⚠️  ALERTA: Última sync há mais de 24h!`);
      }
    } else {
      console.log(`   ❌ ${company.name}: NUNCA sincronizou`);
    }
    console.log('');
  }
  
  // 6. Diagnóstico final
  console.log('\n6️⃣  DIAGNÓSTICO FINAL');
  console.log('='.repeat(80));
  
  const problems = [];
  
  if (!hasCronSecret) {
    problems.push({
      issue: 'CRON_SECRET não configurada',
      solution: 'Adicione a variável no painel da Vercel (Settings > Environment Variables)',
      priority: 'CRÍTICO',
    });
  }
  
  if (companiesWithConnection.length === 0) {
    problems.push({
      issue: 'Nenhuma empresa conectada ao Tiny',
      solution: 'Acesse /admin/conexoes-tiny e conecte ao menos uma empresa',
      priority: 'CRÍTICO',
    });
  }
  
  if (recentSyncs.length === 0) {
    problems.push({
      issue: 'Nenhuma sincronização nas últimas 24h',
      solution: 'Verifique se o cron está habilitado no painel da Vercel (Settings > Cron Jobs)',
      priority: 'ALTO',
    });
  }
  
  const failedSyncs = recentSyncs.filter(s => s.status === 'FAILED');
  if (failedSyncs.length > 0) {
    problems.push({
      issue: `${failedSyncs.length} sincronizações falharam`,
      solution: 'Verifique os logs detalhados acima para identificar os erros',
      priority: 'MÉDIO',
    });
  }
  
  if (problems.length === 0) {
    console.log('\n✅ TUDO OK! Sistema de sincronização automática funcionando.');
  } else {
    console.log('\n❌ PROBLEMAS ENCONTRADOS:\n');
    
    for (let i = 0; i < problems.length; i++) {
      const p = problems[i];
      console.log(`${i + 1}. [${p.priority}] ${p.issue}`);
      console.log(`   💡 ${p.solution}\n`);
    }
  }
  
  // 7. Instruções para teste manual
  console.log('\n7️⃣  COMO TESTAR MANUALMENTE');
  console.log('='.repeat(80));
  console.log('\nPara testar o endpoint de cron manualmente:\n');
  console.log('curl -X POST https://adds-contador.vercel.app/api/admin/sync \\');
  console.log('  -H "Authorization: Bearer SEU_CRON_SECRET" \\');
  console.log('  -H "Content-Type: application/json"\n');
  console.log('(Substitua SEU_CRON_SECRET pelo valor real da variável)\n');
  
  console.log('='.repeat(80));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
