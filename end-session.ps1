param(
  [string]$Message = "",
  [switch]$SkipPush,
  [switch]$SkipDeploy,
  [switch]$Verify
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sessionScript = Join-Path $scriptRoot "KCS Nexus\scripts\session-commit.ps1"

$sessionParams = @{}
if (-not [string]::IsNullOrWhiteSpace($Message)) {
  $sessionParams["Message"] = $Message
}
if ($SkipPush) {
  $sessionParams["SkipPush"] = $true
}
if ($SkipDeploy) {
  $sessionParams["SkipDeploy"] = $true
}
if ($Verify) {
  $sessionParams["Verify"] = $true
}

& $sessionScript @sessionParams
