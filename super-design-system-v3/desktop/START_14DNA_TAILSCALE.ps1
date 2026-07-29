$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) { throw 'Tailscale is required.' }
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
$env:DNA_BIND_HOST = '127.0.0.1'
if (-not $env:PORT) { $env:PORT = '4314' }
$process = Start-Process node -ArgumentList 'server.mjs' -PassThru -NoNewWindow
Start-Sleep -Seconds 2
try {
  tailscale serve --bg https / "http://127.0.0.1:$($env:PORT)"
  $status = tailscale status --json | ConvertFrom-Json
  $dns = $status.Self.DNSName.TrimEnd('.')
  Write-Host "14DNA-ENGINE Render Node: https://$dns"
  Write-Host 'Set this URL in the mobile PWA settings.'
  Wait-Process -Id $process.Id
} finally {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id }
}
