# Uso: .\Iniciar-ConduzAPP.ps1            (navegador do PC)
#      .\Iniciar-ConduzAPP.ps1 -Celular   (Expo Go no celular, mesma rede Wi-Fi)
#      .\Iniciar-ConduzAPP.ps1 -Celular -IP 192.168.0.15   (força o IP anunciado)
param([switch]$Celular, [string]$IP)
. "$PSScriptRoot\scripts\ambiente.ps1"
function PortOpen([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $client.Dispose() }
}
function OpenToNetwork([int]$port) {
  @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -eq '0.0.0.0' }).Count -gt 0
}
if ($Celular) {
  if ((PortOpen 4400) -and -not (OpenToNetwork 9099)) {
    throw 'O Firebase local está aberto só para este PC. Rode .\Parar-ConduzAPP.ps1 e depois .\Iniciar-ConduzAPP.ps1 -Celular.'
  }
  if (PortOpen 8081) {
    throw 'O Metro já está aberto na porta 8081. Rode .\Parar-ConduzAPP.ps1 (ou feche o Metro) e depois .\Iniciar-ConduzAPP.ps1 -Celular.'
  }
}
if (-not (PortOpen 4400)) {
 $argsList = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $projectRoot 'scripts\run-emulators.ps1') + '"'))
 if ($Celular) { $argsList += '-Rede' }
 $p = Start-Process powershell.exe -ArgumentList $argsList -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot '.tools\emulators.out.log') -RedirectStandardError (Join-Path $projectRoot '.tools\emulators.err.log')
 Write-Output "Iniciando emuladores (PID $($p.Id))."
}
$ready = $false
for ($i=0;$i -lt 180;$i++) { if ((PortOpen 5001) -and (PortOpen 8080) -and (PortOpen 9099) -and (PortOpen 9199)) { $ready=$true;break }; if ($i % 15 -eq 0) { Write-Output 'Aguardando inicialização do Firebase local…' }; Start-Sleep -Seconds 2 }
if (-not $ready) { throw 'Emuladores ainda indisponíveis. Consulte .tools\emulators.err.log e tente novamente.' }
# Sem base pré-carregada: os dados vêm de .emulator-data (o que os usuários cadastraram).
# O autosalvamento grava uma cópia a cada 2 minutos enquanto os emuladores estiverem no ar.
$autosave = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('autosalvar.ps1') }
if (-not $autosave) {
 $argsList = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $projectRoot 'scripts\autosalvar.ps1') + '"'))
 Start-Process powershell.exe -ArgumentList $argsList -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.tools\autosave.out.log') -RedirectStandardError (Join-Path $projectRoot '.tools\autosave.err.log') | Out-Null
 Write-Output 'Salvamento automático ativo (a cada 2 minutos).'
}
if ($Celular) {
 # O Metro roda nesta janela para o QR Code do Expo Go aparecer aqui.
 Write-Output 'Modo celular: Firebase local aberto na rede. Use só em Wi-Fi confiável (casa).'
 Write-Output 'Celular e PC na mesma rede Wi-Fi. Se o Windows perguntar, libere Node e Java em "Redes privadas".'
 if ($IP) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $IP }
 Write-Output 'Para encerrar sem perder dados: Ctrl+C e depois .\Parar-ConduzAPP.ps1'
 & (Join-Path $projectRoot 'scripts\run-web.ps1') -Celular
 return
}
if (-not (PortOpen 8081)) {
 $argsList = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $projectRoot 'scripts\run-web.ps1') + '"'))
 $p = Start-Process powershell.exe -ArgumentList $argsList -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot '.tools\web.out.log') -RedirectStandardError (Join-Path $projectRoot '.tools\web.err.log')
 Write-Output "Iniciando aplicativo (PID $($p.Id))."
}
Write-Output 'Aplicativo: http://localhost:8081 | Emuladores: http://127.0.0.1:4000'
Write-Output 'Para encerrar sem perder dados: Parar-ConduzAPP.ps1'
