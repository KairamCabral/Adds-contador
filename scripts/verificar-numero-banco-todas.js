/**
 * VERIFICAR: Alguma conta tem numeroBanco preenchido?
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function decrypt(payload) {
  const ALGO = "aes-256-gcm";
  const IV_LENGTH = 12;
  const AUTH_TAG_LENGTH = 16;
  
  const key = Buffer.from(process.env.ENCRYPTION_MASTER_KEY || '', 'base64');
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGO, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

async function verificarTodas() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 PROCURANDO numeroBanco PREENCHIDO                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    const connection = await prisma.tinyConnection.findFirst();
    if (!connection) {
      console.error('❌ Nenhuma conexão encontrada');
      return;
    }

    const accessToken = decrypt(connection.accessTokenEnc);

    const hoje = new Date().toISOString().split('T')[0];
    const umMesAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`📅 Período: ${umMesAtras} a ${hoje}\n`);
    console.log('🔎 Analisando todas as contas recebidas...\n');

    const respLista = await fetch(
      `https://erp.tiny.com.br/public-api/v3/contas-receber?dataInicial=${umMesAtras}&dataFinal=${hoje}&situacao=pago&pagina=1`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!respLista.ok) {
      console.log(`❌ Erro: ${respLista.status}`);
      return;
    }

    const data = await respLista.json();
    const contas = data.itens || [];
    
    console.log(`✅ Total de contas: ${contas.length}\n`);

    let totalComNumeroBanco = 0;
    let totalSemNumeroBanco = 0;
    const exemplosComBanco = [];
    const exemplosFormas = {};

    for (const conta of contas) {
      if (conta.numeroBanco && conta.numeroBanco !== null && conta.numeroBanco !== '') {
        totalComNumeroBanco++;
        if (exemplosComBanco.length < 5) {
          exemplosComBanco.push({
            id: conta.id,
            cliente: conta.cliente?.nome,
            numeroBanco: conta.numeroBanco,
            valor: conta.valor
          });
        }
      } else {
        totalSemNumeroBanco++;
      }
      
      // Coletar estatísticas de formas de recebimento
      const forma = conta.formaRecebimento?.nome || 'N/D';
      exemplosFormas[forma] = (exemplosFormas[forma] || 0) + 1;
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 ESTATÍSTICAS:\n');
    console.log(`   Total analisadas: ${contas.length}`);
    console.log(`   ✅ Com numeroBanco: ${totalComNumeroBanco}`);
    console.log(`   ❌ Sem numeroBanco: ${totalSemNumeroBanco}`);
    console.log(`   📈 Taxa preenchimento: ${((totalComNumeroBanco/contas.length)*100).toFixed(1)}%\n`);

    if (exemplosComBanco.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('✅ EXEMPLOS COM numeroBanco PREENCHIDO:\n');
      exemplosComBanco.forEach((ex, i) => {
        console.log(`   ${i + 1}. ID: ${ex.id}`);
        console.log(`      Cliente: ${ex.cliente}`);
        console.log(`      numeroBanco: "${ex.numeroBanco}"`);
        console.log(`      Valor: R$ ${ex.valor}\n`);
      });
    } else {
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('❌ NENHUMA conta com numeroBanco preenchido!\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 DISTRIBUIÇÃO POR FORMA DE RECEBIMENTO:\n');
    Object.entries(exemplosFormas)
      .sort((a, b) => b[1] - a[1])
      .forEach(([forma, qtd]) => {
        console.log(`   ${forma}: ${qtd} contas`);
      });

    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🎯 CONCLUSÃO                                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (totalComNumeroBanco > 0) {
      console.log('✅ Campo numeroBanco EXISTE e está PREENCHIDO em algumas contas!\n');
      console.log('   → PRÓXIMO PASSO:');
      console.log('     1. Atualizar transformer para extrair numeroBanco');
      console.log('     2. Mostrar esse valor no campo "Conta Bancária"');
      console.log('     3. Pode precisar mapear código → nome do banco\n');
    } else {
      console.log('❌ Campo numeroBanco existe mas está VAZIO em todas as contas\n');
      console.log('   Possíveis motivos:');
      console.log('   1. Tiny não preenche esse campo para contas recebidas');
      console.log('   2. Cliente não cadastra banco nas contas a receber');
      console.log('   3. Campo só é usado para contas abertas (não pagas)\n');
      console.log('   → RECOMENDAÇÃO: Manter "N/D" pois não há dados\n');
    }

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verificarTodas().catch(console.error);
