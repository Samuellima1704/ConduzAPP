# Teste de carga com k6 contra os emuladores (o app precisa estar rodando).
# Cria o cenário isolado, executa tests/load-test.js e remove o cenário no final.
# O resumo fica em .tools\k6-resultado.txt.
. "$PSScriptRoot\ambiente.ps1"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$k6 = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools\k6') -Recurse -Filter 'k6.exe' | Select-Object -First 1
if (-not $k6) { throw 'k6 não encontrado em .tools\k6.' }
& node scripts/cenario-carga.cjs
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o cenário de carga.' }
try {
  & $k6.FullName run tests/load-test.js *>&1 | Tee-Object -FilePath (Join-Path $projectRoot '.tools\k6-resultado.txt')
} finally {
  & node scripts/cenario-carga.cjs --limpar
}
