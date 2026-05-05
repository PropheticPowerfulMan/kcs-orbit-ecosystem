param(
  [switch]$SkipDatabasePreparation,
  [switch]$SkipInstall,
  [switch]$NoFrontends,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$orbitPath = Join-Path $repoRoot 'kcs-orbit-api'
$kcsNexusBackendPath = Join-Path $repoRoot 'KCS Nexus\backend'
$kcsNexusFrontendPath = Join-Path $repoRoot 'KCS Nexus\frontend'
$eduPayRootPath = Join-Path $repoRoot 'EduPay Smart System'
$eduPayApiPath = Join-Path $eduPayRootPath 'apps\api'
$eduPayWebPath = Join-Path $eduPayRootPath 'apps\web'
$eduSyncBackendPath = Join-Path $repoRoot 'EduSync AI\backend'
$eduSyncFrontendPath = Join-Path $repoRoot 'EduSync AI\frontend'
$eduSyncPythonPath = Join-Path $repoRoot 'EduSync AI\.venv\Scripts\python.exe'
$savanexBackendPath = Join-Path $repoRoot 'SAVANEX Project\backend'
$savanexFrontendPath = Join-Path $repoRoot 'SAVANEX Project\frontend'
$savanexPythonPath = Join-Path $savanexBackendPath '.venv311\Scripts\python.exe'

$orbitDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/kcs_orbit'
$eduPayDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/edupay?schema=public'
$orbitUrl = 'http://localhost:4500'

$integrationKeys = @{
  KcsNexus = 'kcs-nexus-dev-key'
  EduPay = 'edupay-dev-key'
  EduSyncAI = 'edusyncai-dev-key'
  Savanex = 'savanex-dev-key'
}

$frontendUrls = @(
  'http://localhost:5173/',
  'http://localhost:5174/EduPay-Smart-System/',
  'http://localhost:5175/',
  'http://localhost:3000/Syst-me-de-gestion-scolaire/'
)

function Write-Step {
  param([string]$Message)

  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Assert-Path {
  param([string]$Path, [string]$Label)

  if (-not (Test-Path $Path)) {
    throw "$Label not found: $Path"
  }
}

function Invoke-InDirectory {
  param(
    [string]$Path,
    [scriptblock]$Script
  )

  Push-Location $Path
  try {
    & $Script
  }
  finally {
    Pop-Location
  }
}

function Ensure-EduPayWebDependencies {
  if ($SkipInstall) {
    return
  }

  $viteBinary = Join-Path $eduPayWebPath 'node_modules\.bin\vite.cmd'
  if (Test-Path $viteBinary) {
    return
  }

  Write-Step 'Installing missing EduPay web dependencies'
  Invoke-InDirectory -Path $eduPayWebPath -Script {
    & pnpm install
  }
}

function Get-OrbitOrganizationId {
  Invoke-InDirectory -Path $orbitPath -Script {
    $env:DATABASE_URL = $orbitDatabaseUrl
    $nodeScript = @'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

prisma.organization.findUnique({ where: { slug: "kcs-core" } })
  .then((org) => {
    console.log(org ? org.id : "");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
'@
    $result = $nodeScript | & node
    return ($result | Select-Object -Last 1).Trim()
  }
}

function Start-ServiceWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  $windowTitle = "Ecosystem | $Title"
  $fullCommand = "$host.UI.RawUI.WindowTitle = '$windowTitle'; $Command"

  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    $fullCommand
  ) -WorkingDirectory $repoRoot | Out-Null

  Write-Host "Started $Title" -ForegroundColor Green
}

Assert-Command -Name 'node'
Assert-Command -Name 'npm'
Assert-Command -Name 'pnpm'

Assert-Path -Path $orbitPath -Label 'Orbit directory'
Assert-Path -Path $kcsNexusBackendPath -Label 'KCS Nexus backend directory'
Assert-Path -Path $kcsNexusFrontendPath -Label 'KCS Nexus frontend directory'
Assert-Path -Path $eduPayApiPath -Label 'EduPay API directory'
Assert-Path -Path $eduPayWebPath -Label 'EduPay web directory'
Assert-Path -Path $eduSyncBackendPath -Label 'EduSync AI backend directory'
Assert-Path -Path $eduSyncFrontendPath -Label 'EduSync AI frontend directory'
Assert-Path -Path $savanexBackendPath -Label 'SAVANEX backend directory'
Assert-Path -Path $savanexFrontendPath -Label 'SAVANEX frontend directory'
Assert-Path -Path $eduSyncPythonPath -Label 'EduSync AI Python interpreter'
Assert-Path -Path $savanexPythonPath -Label 'SAVANEX Python interpreter'

Write-Step 'Checking local PostgreSQL availability'
$postgresCheck = Test-NetConnection localhost -Port 5432
if (-not $postgresCheck.TcpTestSucceeded) {
  throw 'Local PostgreSQL is not reachable on localhost:5432.'
}

Ensure-EduPayWebDependencies

if (-not $SkipDatabasePreparation) {
  Write-Step 'Preparing Orbit database'
  Invoke-InDirectory -Path $orbitPath -Script {
    $env:DATABASE_URL = $orbitDatabaseUrl
    & npx prisma db push
    & npm run seed
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  }

  Write-Step 'Preparing KCS Nexus database'
  Invoke-InDirectory -Path $kcsNexusBackendPath -Script {
    & npm run prisma:generate
    & npm run prisma:migrate
  }

  Write-Step 'Preparing EduPay database'
  Invoke-InDirectory -Path $eduPayApiPath -Script {
    $env:DATABASE_URL = $eduPayDatabaseUrl
    & pnpm exec prisma db push --accept-data-loss
  }
}

$orbitOrganizationId = Get-OrbitOrganizationId
if ([string]::IsNullOrWhiteSpace($orbitOrganizationId)) {
  throw 'Could not resolve the Orbit organization ID.'
}

Write-Step 'Launching ecosystem services'

Start-ServiceWindow -Title 'KCS Orbit API' -Command (
  "Set-Location '$orbitPath'; " +
  "`$env:DATABASE_URL='$orbitDatabaseUrl'; " +
  "`$env:PORT='4500'; " +
  "`$env:KCS_NEXUS_INTEGRATION_KEY='$($integrationKeys.KcsNexus)'; " +
  "`$env:EDUPAY_INTEGRATION_KEY='$($integrationKeys.EduPay)'; " +
  "`$env:EDUSYNCAI_INTEGRATION_KEY='$($integrationKeys.EduSyncAI)'; " +
  "`$env:SAVANEX_INTEGRATION_KEY='$($integrationKeys.Savanex)'; " +
  "npm run dev"
)

Start-ServiceWindow -Title 'KCS Nexus Backend' -Command (
  "Set-Location '$kcsNexusBackendPath'; " +
  "`$env:KCS_ORBIT_API_URL='$orbitUrl'; " +
  "`$env:KCS_ORBIT_API_KEY='$($integrationKeys.KcsNexus)'; " +
  "`$env:KCS_ORBIT_ORGANIZATION_ID='$orbitOrganizationId'; " +
  "npm run dev"
)

Start-ServiceWindow -Title 'EduPay API' -Command (
  "Set-Location '$eduPayApiPath'; " +
  "`$env:DATABASE_URL='$eduPayDatabaseUrl'; " +
  "`$env:PORT='4000'; " +
  "`$env:KCS_ORBIT_API_URL='$orbitUrl'; " +
  "`$env:KCS_ORBIT_API_KEY='$($integrationKeys.EduPay)'; " +
  "`$env:KCS_ORBIT_ORGANIZATION_ID='$orbitOrganizationId'; " +
  "pnpm dev"
)

Start-ServiceWindow -Title 'EduSync AI Backend' -Command (
  "Set-Location '$eduSyncBackendPath'; " +
  "`$env:DATABASE_URL='sqlite:///./edusync.db'; " +
  "`$env:KCS_ORBIT_API_URL='$orbitUrl'; " +
  "`$env:KCS_ORBIT_API_KEY='$($integrationKeys.EduSyncAI)'; " +
  "`$env:KCS_ORBIT_ORGANIZATION_ID='$orbitOrganizationId'; " +
  "& '$eduSyncPythonPath' -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
)

Start-ServiceWindow -Title 'SAVANEX Backend' -Command (
  "Set-Location '$savanexBackendPath'; " +
  "`$env:DB_ENGINE='django.db.backends.sqlite3'; " +
  "Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue; " +
  "Remove-Item Env:DB_USER -ErrorAction SilentlyContinue; " +
  "Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue; " +
  "Remove-Item Env:DB_HOST -ErrorAction SilentlyContinue; " +
  "Remove-Item Env:DB_PORT -ErrorAction SilentlyContinue; " +
  "`$env:KCS_ORBIT_API_URL='$orbitUrl'; " +
  "`$env:KCS_ORBIT_API_KEY='$($integrationKeys.Savanex)'; " +
  "`$env:KCS_ORBIT_ORGANIZATION_ID='$orbitOrganizationId'; " +
  "& '$savanexPythonPath' manage.py runserver 0.0.0.0:8001"
)

if (-not $NoFrontends) {
  Start-ServiceWindow -Title 'KCS Nexus Frontend' -Command (
    "Set-Location '$kcsNexusFrontendPath'; " +
    "npm run dev -- --host 0.0.0.0 --port 5173"
  )

  Start-ServiceWindow -Title 'EduPay Web' -Command (
    "Set-Location '$eduPayWebPath'; " +
    "pnpm dev -- --host 0.0.0.0 --port 5174"
  )

  Start-ServiceWindow -Title 'EduSync AI Frontend' -Command (
    "Set-Location '$eduSyncFrontendPath'; " +
    "npm run dev -- --host 0.0.0.0 --port 5175"
  )

  Start-ServiceWindow -Title 'SAVANEX Frontend' -Command (
    "Set-Location '$savanexFrontendPath'; " +
    "`$env:VITE_API_URL='http://localhost:8001/api'; " +
    "npm run dev -- --host 0.0.0.0 --port 3000"
  )
}

if ($OpenBrowser -and -not $NoFrontends) {
  Write-Step 'Opening ecosystem frontends in the default browser'
  foreach ($url in $frontendUrls) {
    Start-Process $url | Out-Null
  }
}

Write-Host ''
Write-Host 'Ecosystem startup launched.' -ForegroundColor Green
Write-Host 'Orbit API:           http://localhost:4500' -ForegroundColor Yellow
Write-Host 'KCS Nexus API:       http://localhost:5000' -ForegroundColor Yellow
Write-Host 'KCS Nexus frontend:  http://localhost:5173/' -ForegroundColor Yellow
Write-Host 'EduPay API:          http://localhost:4000' -ForegroundColor Yellow
Write-Host 'EduPay web:          http://localhost:5174/EduPay-Smart-System/' -ForegroundColor Yellow
Write-Host 'EduSync AI API:      http://localhost:8000' -ForegroundColor Yellow
Write-Host 'EduSync AI frontend: http://localhost:5175/' -ForegroundColor Yellow
Write-Host 'SAVANEX API:         http://localhost:8001/' -ForegroundColor Yellow
Write-Host 'SAVANEX frontend:    http://localhost:3000/Syst-me-de-gestion-scolaire/' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Useful switches:' -ForegroundColor Cyan
Write-Host '  -SkipDatabasePreparation : relaunch services without Prisma setup' -ForegroundColor White
Write-Host '  -SkipInstall              : skip the EduPay web dependency check' -ForegroundColor White
Write-Host '  -NoFrontends              : launch only backend services' -ForegroundColor White
Write-Host '  -OpenBrowser              : open frontend URLs automatically after launch' -ForegroundColor White