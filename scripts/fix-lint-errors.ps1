# Script para corrigir erros de linting automaticamente

$files = @(
    "lib/debug.ts",
    "lib/tiny/api.ts",
    "lib/tiny/enrichment.ts",
    "lib/tiny/transformers.ts"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Substituir any por unknown em parâmetros e retornos
    $content = $content -replace '\bany\b', 'unknown'
    
    Set-Content $file $content -NoNewline
    Write-Host "Corrigido: $file"
}

# Corrigir imports não usados em transformers.ts
$transformers = Get-Content "lib/tiny/transformers.ts" -Raw
$transformers = $transformers -replace 'TinyContaReceber,\s*', ''
$transformers = $transformers -replace 'TinyContaPagar,\s*', ''
Set-Content "lib/tiny/transformers.ts" $transformers -NoNewline

Write-Host "`nTodos os arquivos corrigidos!"

