# Salva os dados a cada 2 minutos enquanto os emuladores estiverem no ar.
# Protege contra encerramento abrupto (queda de energia, janela fechada), em que
# o --export-on-exit dos emuladores não chega a rodar.
$ErrorActionPreference = 'Continue'
function HubOpen {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', 4400); return $true } catch { return $false } finally { $client.Dispose() }
}
while (HubOpen) {
  Start-Sleep -Seconds 120
  if (-not (HubOpen)) { break }
  try { & "$PSScriptRoot\salvar-dados.ps1" } catch { Write-Output $_.Exception.Message }
}
