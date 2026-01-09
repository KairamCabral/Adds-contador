# Script para regenerar Prisma Client
# Uso: .\scripts\regenerate-prisma.ps1

Write-Host "🔄 Regenerando Prisma Client..." -ForegroundColor Cyan

# Parar processos Node que possam estar travando os arquivos
Write-Host "Verificando processos Node..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⚠️  Encontrados $($nodeProcesses.Count) processos Node rodando" -ForegroundColor Yellow
    Write-Host "Por favor, pare o servidor Next.js (Ctrl+C) e execute este script novamente." -ForegroundColor Red
    exit 1
}

# Regenerar Prisma Client
Write-Host "Gerando Prisma Client..." -ForegroundColor Cyan
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma Client regenerado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Agora você pode reiniciar o servidor:" -ForegroundColor Cyan
    Write-Host "  npm run dev" -ForegroundColor White
} else {
    Write-Host "❌ Erro ao regenerar Prisma Client" -ForegroundColor Red
    exit 1
}

