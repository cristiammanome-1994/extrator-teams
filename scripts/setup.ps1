# Prepara o ambiente: venv Python, dependencias, e o .env.local do app.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Criando o ambiente virtual Python (.venv)..."
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar o venv. O Python 3 esta instalado e no PATH?" }
}

Write-Host "Instalando dependencias Python..."
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Falha no pip install." }

$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) {
    Write-Warning "Microsoft Edge nao encontrado. O script de exportacao usa o Edge (channel msedge)."
}

Write-Host "Instalando dependencias do app (npm install)..."
Push-Location app
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Falha no npm install." }
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Criado app\.env.local. ABRA-O e troque EXTRATOR_SENHA antes de iniciar."
}
Pop-Location

Write-Host "Pronto. Depois de ajustar a senha, rode scripts\start.ps1 (ou de dois cliques em iniciar.bat)."
