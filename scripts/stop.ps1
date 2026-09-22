# Para o servidor da porta 51794 e tudo que ele iniciou (exportacao em andamento incluida).
$conexoes = Get-NetTCPConnection -LocalPort 51794 -State Listen -ErrorAction SilentlyContinue
if (-not $conexoes) {
    Write-Host "Nada escutando na porta 51794."
    exit 0
}
foreach ($processo in ($conexoes | Select-Object -ExpandProperty OwningProcess -Unique)) {
    Write-Host "Encerrando o processo $processo e seus filhos..."
    taskkill /PID $processo /T /F | Out-Null
}
