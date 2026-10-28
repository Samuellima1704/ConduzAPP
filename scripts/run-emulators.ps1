. "$PSScriptRoot\ambiente.ps1"
$firebaseArgs = @('node_modules/firebase-tools/lib/bin/firebase.js','emulators:start','--project','demo-conduzapp','--export-on-exit','.emulator-data')
# Restaura a última cópia salva; se ela estiver incompleta, usa a anterior.
if (Test-Path -LiteralPath .emulator-data/firebase-export-metadata.json) { $firebaseArgs += @('--import','.emulator-data') }
elseif (Test-Path -LiteralPath .emulator-data.prev/firebase-export-metadata.json) { $firebaseArgs += @('--import','.emulator-data.prev') }
& node @firebaseArgs
