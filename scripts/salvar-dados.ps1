. "$PSScriptRoot\ambiente.ps1"
# Copia o estado atual dos emuladores (contas, Firestore e arquivos) para .emulator-data.
#
# No Windows (especialmente dentro do OneDrive) o Firebase exporta para uma pasta
# temporária firebase-export-* e falha ao renomeá-la (EPERM). Os dados ficam completos
# na pasta temporária; por isso aqui a cópia final é feita com Copy-Item, que não
# depende dessa renomeação. A cópia anterior é mantida em .emulator-data.prev.
$data = Join-Path $projectRoot '.emulator-data'
$next = Join-Path $projectRoot '.emulator-data.next'
$prev = Join-Path $projectRoot '.emulator-data.prev'
$meta = 'firebase-export-metadata.json'
$inicio = Get-Date
if (Test-Path -LiteralPath $next) { Remove-Item -LiteralPath $next -Recurse -Force }
& node node_modules/firebase-tools/lib/bin/firebase.js emulators:export $next --project demo-conduzapp --force *> $null

# Origem: o destino, se o Firebase conseguiu renomear; senão, a pasta temporária desta exportação.
$origem = $null
if (Test-Path -LiteralPath (Join-Path $next $meta)) { $origem = $next }
else {
  $origem = Get-ChildItem -LiteralPath $projectRoot -Directory -Filter 'firebase-export-*' |
    Where-Object { $_.LastWriteTime -ge $inicio.AddSeconds(-5) -and (Test-Path -LiteralPath (Join-Path $_.FullName $meta)) } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $origem) { throw 'Não foi possível salvar os dados. Os emuladores estão rodando?' }

if (Test-Path -LiteralPath $prev) { Remove-Item -LiteralPath $prev -Recurse -Force }
if (Test-Path -LiteralPath $data) {
  try { Rename-Item -LiteralPath $data -NewName '.emulator-data.prev' -ErrorAction Stop }
  catch { Copy-Item -LiteralPath $data -Destination $prev -Recurse -Force; Remove-Item -LiteralPath $data -Recurse -Force }
}
Copy-Item -LiteralPath $origem -Destination $data -Recurse -Force
if (-not (Test-Path -LiteralPath (Join-Path $data $meta))) { throw 'Cópia dos dados incompleta; a versão anterior está em .emulator-data.prev.' }

# Limpeza das pastas temporárias (se alguma ainda estiver bloqueada, sai na próxima vez).
Get-ChildItem -LiteralPath $projectRoot -Directory -Filter 'firebase-export-*' | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path -LiteralPath $next) { Remove-Item -LiteralPath $next -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output ("Dados salvos em .emulator-data (" + (Get-Date -Format 'HH:mm:ss') + ").")
