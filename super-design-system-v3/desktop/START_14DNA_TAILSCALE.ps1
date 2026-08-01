$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) { throw 'Tailscale is required.' }
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }

Write-Host 'Running 14DNA-ENGINE production readiness check...'
& node --env-file=.env scripts/readiness.mjs
if ($LASTEXITCODE -ne 0) { throw 'Readiness check failed. Complete the displayed actions and run this launcher again.' }

$env:DNA_BIND_HOST = '127.0.0.1'
$portValue = (& node --env-file=.env -e "console.log(process.env.PORT||4314)").Trim()
$process = Start-Process node -ArgumentList @('--env-file=.env','server.mjs') -PassThru -NoNewWindow
Start-Sleep -Seconds 2
try {
  tailscale serve --bg https / "http://127.0.0.1:$portValue"
  $status = tailscale status --json | ConvertFrom-Json
  $dns = $status.Self.DNSName.TrimEnd('.')
  $url = "https://$dns"
  Write-Host "14DNA-ENGINE: $url"
  Write-Host "Operations Console: $url/admin.html"
  Write-Host "Quality Review: $url/review.html"
  Wait-Process -Id $process.Id
} finally {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id }
}
