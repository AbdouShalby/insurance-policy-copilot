param([int]$ApiPort = 3000, [int]$IngestPort = 8001)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$python = Join-Path $root 'services/ingest/.venv/Scripts/python.exe'
if (-not (Test-Path $python)) { throw 'Install the Python venv and requirements first; see README.md.' }
$env:PORT = "$ApiPort"
$env:INGEST_URL = "http://127.0.0.1:$IngestPort"
$env:ANTHROPIC_API_KEY = ''
$env:HOST = '127.0.0.1'
if (-not $env:CRM_WEBHOOK_SECRET) { $env:CRM_WEBHOOK_SECRET = 'synthetic-local-demo-only' }
Push-Location (Join-Path $root 'apps/api')
try { npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'API build failed' } } finally { Pop-Location }
foreach ($port in @($IngestPort,$ApiPort)) {
  $probe = [System.Net.Sockets.TcpClient]::new()
  try { $probe.Connect('127.0.0.1', $port); throw "Port $port is already occupied; select alternate ports." }
  catch [System.Net.Sockets.SocketException] { } finally { $probe.Dispose() }
}
$ingest = $null
$api = $null
try {
  $ingest = Start-Process $python -ArgumentList @('-m','uvicorn','main:app','--host','127.0.0.1','--port',"$IngestPort") -WorkingDirectory (Join-Path $root 'services/ingest') -WindowStyle Hidden -PassThru
  $api = Start-Process node -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $root 'apps/api') -WindowStyle Hidden -PassThru
  foreach ($port in @($IngestPort,$ApiPort)) {
    $ready = $false
    for ($attempt=0; $attempt -lt 60; $attempt++) {
      if ($ingest.HasExited -or $api.HasExited) { throw 'A service exited. Check ports and configuration.' }
      try { $null = Invoke-RestMethod "http://127.0.0.1:$port/health"; $ready=$true; break } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "Service on $port did not become ready" }
  }
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$ApiPort/samples" -ContentType 'application/json' -Body '{}' | Out-Null
  Write-Host "Ready: http://127.0.0.1:$ApiPort (Ctrl+C stops owned services)"
  while (-not $api.HasExited -and -not $ingest.HasExited) { Start-Sleep -Seconds 1 }
} finally {
  foreach ($owned in @($api,$ingest)) { if ($owned -and -not $owned.HasExited) { Stop-Process -Id $owned.Id } }
}
