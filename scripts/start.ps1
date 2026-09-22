# Sobe o app em http://127.0.0.1:51794. Gera o build na primeira vez;
# use -Rebuild depois de mudar o codigo.
param([switch]$Rebuild)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\app")

if (-not (Test-Path ".env.local")) { Write-Error "Falta app\.env.local - rode scripts\setup.ps1 primeiro."; exit 1 }
if (-not (Test-Path "node_modules")) { Write-Error "Faltam dependencias - rode scripts\setup.ps1 primeiro."; exit 1 }

$linhaSenha = Get-Content ".env.local" | Where-Object { $_ -match '^\s*EXTRATOR_SENHA\s*=' } | Select-Object -Last 1
$senha = ""
if ($linhaSenha) { $senha = ($linhaSenha -replace '^\s*EXTRATOR_SENHA\s*=', '').Trim() }
if ([string]::IsNullOrWhiteSpace($senha) -or $senha -eq "troque-esta-senha") {
    Write-Error "EXTRATOR_SENHA em app\.env.local esta vazia ou ainda e a senha padrao (troque-esta-senha). Isso deixaria o painel acessivel a qualquer pessoa na rede, guardando conversas reais do Teams. Edite app\.env.local e defina uma senha propria antes de iniciar."
    exit 1
}

if ($Rebuild -or -not (Test-Path ".next\BUILD_ID")) {
    Write-Host "Gerando o build..."
    npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "Servidor em http://127.0.0.1:51794  (Ctrl+C para parar)"
npm run start
