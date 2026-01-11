# Script para corrigir Prisma Client e aplicar migrations

Write-Host "=== Corrigindo Prisma ===" -ForegroundColor Cyan

# 1. Verificar .env
if (Test-Path .env) {
    Write-Host "✓ .env encontrado" -ForegroundColor Green
} else {
    Write-Host "✗ .env não encontrado!" -ForegroundColor Red
    exit 1
}

# 2. Gerar Prisma Client
Write-Host "`n=== Gerando Prisma Client ===" -ForegroundColor Cyan
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Prisma Client gerado com sucesso" -ForegroundColor Green
} else {
    Write-Host "✗ Erro ao gerar Prisma Client" -ForegroundColor Red
}

Write-Host "`n=== Concluído ===" -ForegroundColor Cyan
Write-Host "Agora reinicie o servidor com: npm run dev" -ForegroundColor Yellow
