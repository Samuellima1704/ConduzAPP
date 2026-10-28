. "$PSScriptRoot\scripts\ambiente.ps1"
# Encerra o ConduzAPP sem perder dados: salva tudo e só depois para os processos.
function PortOpen([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $client.Dispose() }
}
if (PortOpen 4400) {
  & "$PSScriptRoot\scripts\salvar-dados.ps1"
} else {
  Write-Output 'Emuladores já estavam parados; nada a salvar.'
}
# Apenas processos desta pasta (Node portátil, Expo, autosalvamento) e os emuladores Java do Firebase.
$root = $projectRoot
$alvos = Get-CimInstance Win32_Process | Where-Object {
  ($_.CommandLine -and $_.CommandLine.Contains($root)) -or
  ($_.Name -eq 'java.exe' -and $_.CommandLine -match 'cloud-firestore-emulator|cloud-storage-rules-runtime')
} | Where-Object { $_.ProcessId -ne $PID }
foreach ($p in $alvos) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Output 'ConduzAPP encerrado. Os dados serão restaurados no próximo Iniciar-ConduzAPP.ps1.'
