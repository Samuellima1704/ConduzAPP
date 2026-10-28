# Executa o teste de ponta a ponta e grava o relatório em .tools\teste-e2e.txt.
# Passe -Limpar para apagar as contas e os dados do último teste.
param([switch]$Limpar)
. "$PSScriptRoot\ambiente.ps1"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$relatorio = Join-Path $projectRoot '.tools\teste-e2e.txt'
if ($Limpar) { & node scripts/testar-tudo.cjs --limpar *>&1 | Tee-Object -FilePath $relatorio }
else { & node scripts/testar-tudo.cjs *>&1 | Tee-Object -FilePath $relatorio }
