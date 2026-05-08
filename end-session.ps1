param(
  [string]$Message = "",
  [switch]$SkipPush,
  [switch]$SkipDeploy,
  [switch]$Verify
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sessionScript = Join-Path $scriptRoot "KCS Nexus\scripts\session-commit.ps1"

$argsList = @()
if (-not [string]::IsNullOrWhiteSpace($Message)) {
  $argsList += @("-Message", $Message)
}
if ($SkipPush) {
  $argsList += "-SkipPush"
}
if ($SkipDeploy) {
  $argsList += "-SkipDeploy"
}
if ($Verify) {
  $argsList += "-Verify"
}

& $sessionScript @argsList
