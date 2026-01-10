/**
 * Gera uma ENCRYPTION_MASTER_KEY válida (32 bytes em base64)
 * 
 * Uso:
 *   node scripts/generate-encryption-key.js
 */

import crypto from 'crypto';

function generateEncryptionKey() {
  // Gera 32 bytes aleatórios
  const key = crypto.randomBytes(32);
  
  // Converte para base64
  const base64Key = key.toString('base64');
  
  console.log('═'.repeat(80));
  console.log('🔑 ENCRYPTION_MASTER_KEY GERADA');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Copie o valor abaixo e adicione na Vercel:');
  console.log('');
  console.log('─'.repeat(80));
  console.log(base64Key);
  console.log('─'.repeat(80));
  console.log('');
  console.log('📋 PASSOS:');
  console.log('');
  console.log('1. Acesse: https://vercel.com/dashboard');
  console.log('2. Selecione seu projeto "adds-contador"');
  console.log('3. Vá em Settings → Environment Variables');
  console.log('4. Adicione nova variável:');
  console.log('   Nome: ENCRYPTION_MASTER_KEY');
  console.log('   Valor: [cole o valor acima]');
  console.log('   Environment: Production, Preview, Development');
  console.log('5. Clique em "Save"');
  console.log('6. Faça Redeploy (Deployments → Redeploy)');
  console.log('');
  console.log('⚠️  IMPORTANTE:');
  console.log('   - Guarde essa chave em local seguro');
  console.log('   - NÃO compartilhe publicamente');
  console.log('   - Se perder, precisará reconectar todas empresas');
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Verificação:');
  console.log(`  Tamanho: ${key.length} bytes ✅ (deve ser 32)`);
  console.log(`  Base64: ${base64Key.length} caracteres`);
  console.log('');
}

generateEncryptionKey();
