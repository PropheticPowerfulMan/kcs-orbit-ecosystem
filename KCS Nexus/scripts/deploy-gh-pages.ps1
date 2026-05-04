param(
  [string]$Message = ""
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

$originUrl = (& git remote get-url origin).Trim()
$repoPath = $originUrl
if ($repoPath -match "github\.com[:/](?<path>[^/]+/[^/.]+)(\.git)?$") {
  $env:GITHUB_REPOSITORY = $Matches.path
}

$env:GITHUB_PAGES = "true"
Push-Location "$repoRoot\frontend"
try {
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
  Remove-Item Env:\GITHUB_PAGES -ErrorAction SilentlyContinue
  Remove-Item Env:\GITHUB_REPOSITORY -ErrorAction SilentlyContinue
}

$worktreePath = Join-Path $repoRoot ".deploy-gh-pages"
if (Test-Path $worktreePath) {
  $resolved = (Resolve-Path $worktreePath).Path
  $rootPrefix = (Resolve-Path $repoRoot).Path.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolved.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove unexpected deploy path: $resolved"
  }
  Remove-Item -LiteralPath $worktreePath -Recurse -Force
  Run-Git worktree prune
}

Run-Git clone --branch gh-pages --single-branch $originUrl $worktreePath
& git -C $worktreePath checkout gh-pages
if ($LASTEXITCODE -ne 0) {
  throw "git -C $worktreePath checkout gh-pages failed with exit code $LASTEXITCODE"
}

Get-ChildItem -LiteralPath $worktreePath -Force |
  Where-Object { $_.Name -ne ".git" } |
  Remove-Item -Recurse -Force

if (Test-Path "$repoRoot\frontend\dist\.git") {
  Remove-Item -LiteralPath "$repoRoot\frontend\dist\.git" -Recurse -Force
}
Copy-Item -Path "$repoRoot\frontend\dist\*" -Destination $worktreePath -Recurse -Force
Copy-Item -Path (Join-Path $worktreePath "index.html") -Destination (Join-Path $worktreePath "404.html") -Force
New-Item -Path (Join-Path $worktreePath ".nojekyll") -ItemType File -Force | Out-Null

& git -C $worktreePath add -A
if ($LASTEXITCODE -ne 0) {
  throw "git -C $worktreePath add -A failed with exit code $LASTEXITCODE"
}

$changes = (& git -C $worktreePath status --porcelain)
if (-not $changes) {
  Write-Host "No gh-pages changes to deploy."
  Remove-Item -LiteralPath $worktreePath -Recurse -Force
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
  $Message = "Deploy GitHub Pages $stamp"
}

& git -C $worktreePath commit -m $Message
if ($LASTEXITCODE -ne 0) {
  throw "git -C $worktreePath commit failed with exit code $LASTEXITCODE"
}

& git -C $worktreePath push origin HEAD:gh-pages
if ($LASTEXITCODE -ne 0) {
  throw "git -C $worktreePath push failed with exit code $LASTEXITCODE"
}

Remove-Item -LiteralPath $worktreePath -Recurse -Force

Write-Host "GitHub Pages deployed: $Message"
