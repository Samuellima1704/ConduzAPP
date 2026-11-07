param([switch]$Rede)
. "$PSScriptRoot\ambiente.ps1"
$firebaseArgs = @('node_modules/firebase-tools/lib/bin/firebase.js','emulators:start','--project','demo-conduzapp','--export-on-exit','.emulator-data')
# Restaura a última cópia salva; se ela estiver incompleta, usa a anterior.
if (Test-Path -LiteralPath .emulator-data/firebase-export-metadata.json) { $firebaseArgs += @('--import','.emulator-data') }
elseif (Test-Path -LiteralPath .emulator-data.prev/firebase-export-metadata.json) { $firebaseArgs += @('--import','.emulator-data.prev') }
# -Rede (Expo Go no celular): Auth, Firestore, Functions e Storage passam a escutar
# também na rede local. O painel (4000) continua só no PC. O firebase.json não muda:
# a cópia firebase.rede.json é gerada aqui e fica fora do Git.
# As Functions continuam recebendo FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.
if ($Rede) {
  $json = (Get-Content -Raw -LiteralPath firebase.json) -replace '"host":"127\.0\.0\.1","port":(9099|8080|5001|9199)\}', '"host":"0.0.0.0","port":$1}'
  [System.IO.File]::WriteAllText((Join-Path $projectRoot 'firebase.rede.json'), $json, (New-Object System.Text.UTF8Encoding $false))
  $firebaseArgs += @('--config','firebase.rede.json')
}
& node @firebaseArgs
