param([Parameter(Mandatory=$true)][ValidateSet('--metadata-only','--runtime-only')][string]$Mode)
$ErrorActionPreference = 'Stop'
# Native runtime only; do not install, copy credentials or change user settings.
try {
  $native = Get-Command node.exe -ErrorAction SilentlyContinue
  $runtime = if ($native) { $native.Source } else { $null }
  $electron = $false
  if (-not $runtime) {
    $candidates = @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe", "$env:LOCALAPPDATA\Programs\Microsoft VS Code Insiders\Code - Insiders.exe", 'C:\Program Files\Microsoft VS Code\Code.exe')
    $runtime = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    $electron = [bool]$runtime
  }
  if (-not $runtime) { throw 'native_runtime_unavailable' }
  $prior = $env:ELECTRON_RUN_AS_NODE
  try {
    if ($electron) { $env:ELECTRON_RUN_AS_NODE = '1' }
    # PowerShell otherwise returns before a GUI-subsystem Electron executable
    # finishes. Piping waits and forwards only the child's bounded safe report.
    & $runtime (Join-Path $PSScriptRoot 'child-calendar-native.js') $Mode | Out-String
    $result = $LASTEXITCODE
  } finally { $env:ELECTRON_RUN_AS_NODE = $prior }
  exit $result
} catch {
  Write-Output '{"status":"preflight_blocked","stage":"native_runtime","code":"unavailable","calendarQueries":0,"cloudChanges":false,"automaticRetry":false}'
  exit 1
}