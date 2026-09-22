@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo  Extrator Teams - iniciar
echo ===============================================
echo.
echo Na primeira vez o build leva alguns instantes;
echo se o navegador abrir antes, atualize a pagina.
echo.

start "Extrator Teams - servidor" powershell -NoExit -ExecutionPolicy Bypass -File "scripts\start.ps1"
timeout /t 8 /nobreak >nul
start "" "http://127.0.0.1:51794"

endlocal
