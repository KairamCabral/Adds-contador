# ============================================
# LIMPAR DADOS SINCRONIZADOS
# ============================================
# Script PowerShell para Windows
# Uso: .\scripts\limpar-dados-sync.ps1
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  LIMPAR DADOS SINCRONIZADOS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Confirmar ação
Write-Host "⚠️  ATENÇÃO: Este script irá apagar TODOS os dados sincronizados!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Dados que serão apagados:" -ForegroundColor Yellow
Write-Host "  • Vendas" -ForegroundColor Yellow
Write-Host "  • Contas a Receber/Pagar/Pagas/Recebidas" -ForegroundColor Yellow
Write-Host "  • Estoque" -ForegroundColor Yellow
Write-Host "  • Cache de produtos" -ForegroundColor Yellow
Write-Host "  • Histórico de sincronizações" -ForegroundColor Yellow
Write-Host ""
Write-Host "Dados que serão mantidos:" -ForegroundColor Green
Write-Host "  • Usuários" -ForegroundColor Green
Write-Host "  • Conexões Tiny (tokens OAuth)" -ForegroundColor Green
Write-Host "  • Configurações da empresa" -ForegroundColor Green
Write-Host ""

$confirmacao = Read-Host "Deseja continuar? (digite SIM para confirmar)"

if ($confirmacao -ne "SIM") {
    Write-Host ""
    Write-Host "❌ Operação cancelada pelo usuário." -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "🗑️  Iniciando limpeza..." -ForegroundColor Cyan
Write-Host ""

# Executar script Node.js
node scripts/limpar-dados-sync.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✅ LIMPEZA CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Próximos passos:" -ForegroundColor Cyan
    Write-Host "   1. Inicie a aplicação: npm run dev" -ForegroundColor White
    Write-Host "   2. Acesse a interface web" -ForegroundColor White
    Write-Host "   3. Clique em 'Sincronizar' no header" -ForegroundColor White
    Write-Host "   4. Escolha o período e aguarde" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erro ao executar limpeza." -ForegroundColor Red
    Write-Host ""
    exit 1
}
