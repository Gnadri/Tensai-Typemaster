param(
  [int]$Port = 8080,
  [string]$HostName = "localhost",
  [int]$WaitSeconds = 60
)

$ErrorActionPreference = "Stop"

function Resolve-NpmCmd {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    (Join-Path $env:ProgramFiles "nodejs\\npm.cmd"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\\npm.cmd")
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($candidates.Count -gt 0) { return $candidates[0] }
  return $null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$url = "http://${HostName}:${Port}/"

Write-Host "Starting web dev server in: $repoRoot"
Write-Host "Target URL: $url"

$npmCmd = Resolve-NpmCmd
if (-not $npmCmd) {
  Write-Error "npm.cmd not found. Install Node.js and make sure it's on your system PATH."
  exit 1
}

# Poll/open the browser in a hidden PowerShell so this console can stay attached to `npm run web`.
$poll =
  '$ErrorActionPreference="SilentlyContinue";' +
  '$deadline=(Get-Date).AddSeconds(' + $WaitSeconds + ');' +
  'while((Get-Date)-lt $deadline){' +
  ' try { Invoke-WebRequest -Uri "' + $url + '" -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process "' + $url + '" | Out-Null; break } catch {};' +
  ' Start-Sleep -Milliseconds 500 }'

Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  $poll
) | Out-Null

Push-Location $repoRoot
try {
  & $npmCmd run web
} finally {
  Pop-Location
}
