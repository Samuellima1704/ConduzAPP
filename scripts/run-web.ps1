param([switch]$Celular)
. "$PSScriptRoot\ambiente.ps1"
# O modo CI desativa a observação de arquivos do Metro no desenvolvimento.
# Testes/build continuam usando CI definido em ambiente.ps1.
$env:CI = $null
$env:EXPO_PUBLIC_FIREBASE_MODE = 'emulator'
$env:EXPO_NO_TELEMETRY = '1'
$env:EXPO_OFFLINE = '1'
# -Celular: o Expo anuncia o IP do PC na rede (QR Code do Expo Go) e o app no
# celular usa esse mesmo IP para falar com os emuladores (ver firebase-config.ts).
$modo = if ($Celular) { '--lan' } else { '--localhost' }
& node node_modules/expo/bin/cli start --web --port 8081 $modo
