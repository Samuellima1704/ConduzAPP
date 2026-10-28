. "$PSScriptRoot\scripts\ambiente.ps1"
function PortOpen([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $client.Dispose() }
}
if (-not (PortOpen 4400)) {
 $argsList = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $projectRoot 'scripts\run-emulators.ps1') + '"'))
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
if (-not (PortOpen 8081)) {
 $argsList = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $projectRoot 'scripts\run-web.ps1') + '"'))
 $p = Start-Process powershell.exe -ArgumentList $argsList -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot '.tools\web.out.log') -RedirectStandardError (Join-Path $projectRoot '.tools\web.err.log')
 Write-Output "Iniciando aplicativo (PID $($p.Id))."
}
Write-Output 'Aplicativo: http://localhost:8081 | Emuladores: http://127.0.0.1:4000'
Write-Output 'Para encerrar sem perder dados: Parar-ConduzAPP.ps1'
