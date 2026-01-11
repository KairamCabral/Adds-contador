/**
 * Script para aplicar migrations no banco
 */

const { execSync } = require('child_process');

console.log('=== Aplicando Migrations ===\n');

try {
  // Carregar .env
  require('dotenv').config();
  
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Configurada' : '✗ Não encontrada');
  
  if (!process.env.DATABASE_URL) {
    console.error('\n✗ DATABASE_URL não encontrada no .env!');
    process.exit(1);
  }
  
  console.log('\nAplicando migrations...');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  
  console.log('\n✓ Migrations aplicadas com sucesso!');
  console.log('\nAgora reinicie o servidor: npm run dev');
  
} catch (error) {
  console.error('\n✗ Erro ao aplicar migrations:', error.message);
  process.exit(1);
}
