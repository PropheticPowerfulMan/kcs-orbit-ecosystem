param(
  [string]$Message = "",
  [switch]$Push,
  [switch]$SkipPush,
  [switch]$SkipDeploy,
  [switch]$Verify
)

$ErrorActionPreference = "Stop"

function Run-Git {
  & git @args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
  throw "This folder is not inside a Git repository."
}

Set-Location $repoRoot

$changes = (& git status --porcelain)
if (-not $changes) {
  Write-Host "No changes to commit."
  if (-not $SkipPush) {
    Run-Git push
  }
  exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Session autosave $timestamp"
}

Run-Git add -A

$stagedChanges = (& git diff --cached --name-only)
if (-not $stagedChanges) {
  Write-Host "No staged changes to commit."
  if (-not $SkipPush) {
    Run-Git push
  }
  exit 0
}

$frontendPaths = @(
  "KCS Nexus/frontend/*",
  "KCS Nexus/src/*",
  "SAVANEX Project/frontend/*",
  "EduSync AI/frontend/*",
  "EduPay Smart System/apps/web/*"
)

$frontendChanged = $false
foreach ($file in $stagedChanges) {
  foreach ($path in $frontendPaths) {
    if ($file -like $path) {
      $frontendChanged = $true
      break
    }
  }

  if ($frontendChanged) {
    break
  }
}

$commitArgs = @("commit", "-m", $Message)
if (-not $Verify) {
  $commitArgs += "--no-verify"
}

Run-Git @commitArgs

if (-not $SkipPush) {
  Run-Git push
}

Write-Host "Session committed: $Message"

if ($frontendChanged -and -not $SkipDeploy) {
  $kcsFrontendChanged = $false
  foreach ($file in $stagedChanges) {
    if ($file -like "KCS Nexus/frontend/*" -or $file -like "KCS Nexus/src/*") {
      $kcsFrontendChanged = $true
      break
    }
  }

  if ($kcsFrontendChanged) {
    $deployMessage = "Deploy session $timestamp"
    & "$PSScriptRoot\deploy-gh-pages.ps1" -Message $deployMessage
    if ($LASTEXITCODE -ne 0) {
      throw "GitHub Pages deployment failed with exit code $LASTEXITCODE"
    }
  }
  else {
    Write-Host "Live deployment skipped: frontend changes are outside KCS Nexus GitHub Pages."
  }
}
elseif (-not $frontendChanged) {
  Write-Host "Live deployment skipped: no frontend changes detected."
}
