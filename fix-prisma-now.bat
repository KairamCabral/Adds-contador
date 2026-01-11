@echo off
echo === Regenerando Prisma Client ===
cd /d "D:\2 PESSOAL\0 CURSOR\ADDS\Contador"
call npx prisma generate
if %errorlevel% equ 0 (
    echo.
    echo ✓ Prisma Client regenerado com sucesso!
    echo.
    echo Agora inicie o servidor: npm run dev
) else (
    echo.
    echo ✗ Erro ao regenerar Prisma Client
    echo Por favor, certifique-se que o servidor está parado.
)
pause
