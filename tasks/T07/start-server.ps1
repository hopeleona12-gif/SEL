$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Join-Path $root 'runtime\node.exe'
$env:PORT = '4198'
Start-Process -FilePath $node -ArgumentList (Join-Path $root 'server.js') -WorkingDirectory $root -WindowStyle Hidden
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 300
  try {
    if ((Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4198/' -TimeoutSec 1).StatusCode -eq 200) {
      Start-Process 'http://127.0.0.1:4198/?build=separate-a-adjust-audio-20260807'
      exit 0
    }
  } catch { }
}
throw 'T07 server failed to start.'
