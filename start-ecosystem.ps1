param(
  [switch]$SkipDatabasePreparation,
  [switch]$FullPreparation,
  [switch]$SkipInstall,
  [switch]$NoFrontends,
  [switch]$OpenBrowser,
  [switch]$AllowEduPayDataLoss,
  [switch]$Restart,
  [switch]$NoWait
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
$logRoot = Join-Path $repoRoot 'var\logs'
$stateRoot = Join-Path $repoRoot 'var'
$preparationMarkerPath = Join-Path $stateRoot 'ecosystem-prepared.json'
$eduSyncFallbackApiPorts = @(8010, 8011, 8012)
$eduPayAccessCodeMigrationPath = Join-Path $eduPayApiPath 'prisma\migrations\20260510053000_add_user_access_code\migration.sql'

function Get-ConfigValue {
  param(
    [string]$Name,
    [string]$DefaultValue
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  return $value
}

$orbitDatabaseUrl = Get-ConfigValue -Name 'ORBIT_DATABASE_URL' -DefaultValue 'postgresql://postgres:postgres@localhost:5432/kcs_orbit'
$eduPayDatabaseUrl = Get-ConfigValue -Name 'EDUPAY_DATABASE_URL' -DefaultValue 'postgresql://postgres:postgres@localhost:5432/edupay?schema=public'
$orbitUrl = Get-ConfigValue -Name 'KCS_ORBIT_API_URL' -DefaultValue 'http://localhost:4500'
$eduSyncPreferredApiPort = [int](Get-ConfigValue -Name 'EDUSYNC_AI_API_PORT' -DefaultValue '8000')
$eduSyncApiPort = $eduSyncPreferredApiPort

$integrationKeys = @{
  KcsNexus = Get-ConfigValue -Name 'KCS_NEXUS_INTEGRATION_KEY' -DefaultValue 'kcs-nexus-dev-key'
  EduPay = Get-ConfigValue -Name 'EDUPAY_INTEGRATION_KEY' -DefaultValue 'edupay-dev-key'
  EduSyncAI = Get-ConfigValue -Name 'EDUSYNCAI_INTEGRATION_KEY' -DefaultValue 'edusyncai-dev-key'
  Savanex = Get-ConfigValue -Name 'SAVANEX_INTEGRATION_KEY' -DefaultValue 'savanex-dev-key'
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

function Test-PortOpen {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMs = 700
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connectTask = $client.ConnectAsync($HostName, $Port)
    return $connectTask.Wait($TimeoutMs) -and $client.Connected
  }
  catch {
    return $false
  }
  finally {
    $client.Dispose()
  }
}

function Wait-PortOpen {
  param(
    [string]$Name,
    [int]$Port,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen -HostName '127.0.0.1' -Port $Port) {
      Write-Host "Ready $Name on port $Port" -ForegroundColor Green
      return $true
    }

    Start-Sleep -Milliseconds 700
  }

  Write-Host "Not ready yet: $Name on port $Port" -ForegroundColor Yellow
  return $false
}

function Resolve-PreferredPort {
  param(
    [string]$Name,
    [int]$PreferredPort,
    [int[]]$FallbackPorts
  )

  if (-not (Test-PortOpen -HostName '127.0.0.1' -Port $PreferredPort)) {
    return $PreferredPort
  }

  foreach ($fallbackPort in $FallbackPorts) {
    if (-not (Test-PortOpen -HostName '127.0.0.1' -Port $fallbackPort)) {
      Write-Host "$Name port $PreferredPort is busy; using port $fallbackPort for this launch" -ForegroundColor Yellow
      return $fallbackPort
    }
  }

  throw "$Name cannot start: ports $PreferredPort, $($FallbackPorts -join ', ') are all busy."
}

function Resolve-EduSyncApiPort {
  param(
    [int]$PreferredPort,
    [int[]]$FallbackPorts
  )

  $candidatePorts = @($PreferredPort) + ($FallbackPorts | Where-Object { $_ -ne $PreferredPort })
  $runningBackends = Get-EduSyncBackendListeners -Ports $candidatePorts

  if ($runningBackends.Count -gt 0) {
    $selected = $runningBackends | Where-Object { $_.Port -eq $PreferredPort } | Select-Object -First 1
    if (-not $selected) {
      $selected = $runningBackends | Select-Object -First 1
    }

    $duplicates = @($runningBackends | Where-Object { $_.ProcessId -ne $selected.ProcessId })
    foreach ($duplicate in $duplicates) {
      Stop-Process -Id $duplicate.ProcessId -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped duplicate EduSync AI Backend on port $($duplicate.Port)" -ForegroundColor Yellow
    }

    Write-Host "Reusing EduSync AI Backend on port $($selected.Port)" -ForegroundColor Yellow
    return [int]$selected.Port
  }

  return Resolve-PreferredPort -Name 'EduSync AI API' -PreferredPort $PreferredPort -FallbackPorts $FallbackPorts
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

function Get-ListeningProcessInfo {
  param([int[]]$Ports)

  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
    $_.LocalPort -in $Ports
  }

  foreach ($listener in $listeners) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if (-not $processInfo) {
      continue
    }

    [pscustomobject]@{
      Port = [int]$listener.LocalPort
      ProcessId = [int]$listener.OwningProcess
      Name = $processInfo.Name
      CommandLine = $processInfo.CommandLine
    }
  }
}

function Get-EduSyncBackendListeners {
  param([int[]]$Ports)

  return @(Get-ListeningProcessInfo -Ports $Ports | Where-Object {
    $_.Name -eq 'python.exe' -and
    $_.CommandLine -like "*$eduSyncPythonPath*" -and
    $_.CommandLine -like '*app.main:app*'
  } | Sort-Object Port -Unique)
}

function Invoke-EduPayAccessCodeMigration {
  if (-not (Test-Path $eduPayAccessCodeMigrationPath)) {
    throw "EduPay accessCode migration not found: $eduPayAccessCodeMigrationPath"
  }

  & pnpm exec prisma db execute --file $eduPayAccessCodeMigrationPath --schema prisma/schema.prisma
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

function Sync-EduPayApiRuntime {
  if (Test-PortOpen -HostName '127.0.0.1' -Port 4000) {
    Write-Host 'EduPay API already running; skipping Prisma runtime sync' -ForegroundColor Yellow
    return
  }

  Write-Step 'Syncing EduPay API schema and Prisma client'
  Invoke-InDirectory -Path $eduPayApiPath -Script {
    $env:DATABASE_URL = $eduPayDatabaseUrl
    Invoke-EduPayAccessCodeMigration
    & pnpm exec prisma db push
    & pnpm exec prisma generate
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  }
}

function Sync-OrbitRuntime {
  if (Test-PortOpen -HostName '127.0.0.1' -Port 4500) {
    Write-Host 'Orbit API already running; skipping Prisma runtime sync' -ForegroundColor Yellow
    return
  }

  Write-Step 'Syncing Orbit schema and Prisma client'
  Invoke-InDirectory -Path $orbitPath -Script {
    $env:DATABASE_URL = $orbitDatabaseUrl
    & pnpm exec prisma db push
    & pnpm exec prisma generate
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  }
}

function Sync-SavanexDatabase {
  Write-Step 'Syncing SAVANEX database migrations'
  Invoke-InDirectory -Path $savanexBackendPath -Script {
    $env:DB_ENGINE = 'django.db.backends.sqlite3'
    Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:DB_USER -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DB_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PORT -ErrorAction SilentlyContinue
    & $savanexPythonPath manage.py migrate --noinput
  }
}

function Ensure-EduPaySchoolAdmin {
  Invoke-InDirectory -Path $eduPayApiPath -Script {
    $env:DATABASE_URL = $eduPayDatabaseUrl
    $nodeScript = @'
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const school = await prisma.school.upsert({
    where: { id: "kcs-school" },
    update: { name: "Kinshasa Christian School" },
    create: { id: "kcs-school", name: "Kinshasa Christian School" },
  });
  const passwordHash = await bcrypt.hash("password123", 10);
  const accessCode = "ACC-ADM-KCS001";
  await prisma.user.upsert({
    where: { email: "admin@school.com" },
    update: {
      schoolId: school.id,
      fullName: "Admin User",
      role: "ADMIN",
      accessCode,
      passwordHash,
    },
    create: {
      schoolId: school.id,
      fullName: "Admin User",
      email: "admin@school.com",
      role: "ADMIN",
      accessCode,
      passwordHash,
    },
  });
  console.log("EduPay school/admin ready");
})()
  .finally(async () => prisma.$disconnect());
'@
    $nodeScript | & node
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
    [string]$Command,
    [int]$Port,
    [string]$LogName
  )

  if (Test-PortOpen -HostName '127.0.0.1' -Port $Port) {
    Write-Host "Already running $Title on port $Port" -ForegroundColor Yellow
    return
  }

  $windowTitle = "Ecosystem | $Title"
  $logPath = Join-Path $logRoot $LogName
  $fullCommand = (
    "`$host.UI.RawUI.WindowTitle = '$windowTitle'; " +
    "`$ErrorActionPreference = 'Continue'; " +
    "$Command 2>&1 | Tee-Object -FilePath '$logPath' -Append"
  )

  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    $fullCommand
  ) -WorkingDirectory $repoRoot | Out-Null

  Write-Host "Started $Title" -ForegroundColor Green
}

function Start-EduSyncBackend {
  if (Test-PortOpen -HostName '127.0.0.1' -Port $eduSyncApiPort) {
    Write-Host "Already running EduSync AI Backend on port $eduSyncApiPort" -ForegroundColor Yellow
    return
  }

  $windowTitle = 'Ecosystem | EduSync AI Backend'
  $fullCommand = (
    "`$host.UI.RawUI.WindowTitle = '$windowTitle'; " +
    "`$env:DATABASE_URL='sqlite:///./edusync.db'; " +
    "`$env:KCS_ORBIT_API_URL='$orbitUrl'; " +
    "`$env:KCS_ORBIT_API_KEY='$($integrationKeys.EduSyncAI)'; " +
    "`$env:KCS_ORBIT_ORGANIZATION_ID='$orbitOrganizationId'; " +
    "Set-Location '$eduSyncBackendPath'; " +
    "& '$eduSyncPythonPath' -m uvicorn app.main:app --host 0.0.0.0 --port $eduSyncApiPort"
  )

  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    $fullCommand
  ) -WorkingDirectory $repoRoot | Out-Null

  Write-Host "Started EduSync AI Backend" -ForegroundColor Green
}

if ($Restart) {
  Write-Step 'Stopping existing ecosystem services before restart'
  & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'stop-ecosystem.ps1') -Force
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

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
if (-not (Test-PortOpen -HostName '127.0.0.1' -Port 5432 -TimeoutMs 1500)) {
  throw 'Local PostgreSQL is not reachable on localhost:5432.'
}

Ensure-EduPayWebDependencies

if ($FullPreparation -and $SkipDatabasePreparation) {
  throw 'Use either -FullPreparation or -SkipDatabasePreparation, not both.'
}

$databasePreparationMode = 'full'
if ($SkipDatabasePreparation) {
  $databasePreparationMode = 'skipped-by-user'
}
elseif ((Test-Path $preparationMarkerPath) -and -not $FullPreparation) {
  $databasePreparationMode = 'cached'
}

if ($databasePreparationMode -eq 'cached') {
  Write-Step 'Using cached database preparation'
  Write-Host "Marker: $preparationMarkerPath" -ForegroundColor DarkGray
  Write-Host 'Use -FullPreparation if schemas, seeds, or local databases changed.' -ForegroundColor DarkGray
}

if ($databasePreparationMode -eq 'skipped-by-user') {
  Write-Step 'Skipping database preparation by request'
}

if ($databasePreparationMode -ne 'full') {
  Sync-OrbitRuntime
  Sync-EduPayApiRuntime
  Sync-SavanexDatabase

  Write-Step 'Checking EduPay school/admin seed'
  Ensure-EduPaySchoolAdmin
}

if ($databasePreparationMode -eq 'full') {
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
    Invoke-EduPayAccessCodeMigration
    if ($AllowEduPayDataLoss) {
      & pnpm exec prisma db push --accept-data-loss
    }
    else {
      & pnpm exec prisma db push
    }
    $nodeScript = @'
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const school = await prisma.school.upsert({
    where: { id: "kcs-school" },
    update: { name: "Kinshasa Christian School" },
    create: { id: "kcs-school", name: "Kinshasa Christian School" },
  });
  const passwordHash = await bcrypt.hash("password123", 10);
  const accessCode = "ACC-ADM-KCS001";
  await prisma.user.upsert({
    where: { email: "admin@school.com" },
    update: {
      schoolId: school.id,
      fullName: "Admin User",
      role: "ADMIN",
      accessCode,
      passwordHash,
    },
    create: {
      schoolId: school.id,
      fullName: "Admin User",
      email: "admin@school.com",
      role: "ADMIN",
      accessCode,
      passwordHash,
    },
  });
  console.log("EduPay school/admin ready");
})()
  .finally(async () => prisma.$disconnect());
'@
    $nodeScript | & node
  }

  Write-Step 'Preparing SAVANEX database'
  Invoke-InDirectory -Path $savanexBackendPath -Script {
    $env:DB_ENGINE = 'django.db.backends.sqlite3'
    Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:DB_USER -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DB_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PORT -ErrorAction SilentlyContinue
    & $savanexPythonPath manage.py migrate
    & $savanexPythonPath manage.py shell -c "from apps.users.models import User; user, created = User.objects.get_or_create(username='admin', defaults={'email':'admin@savanex.local','first_name':'KCS','last_name':'Admin','role':User.ROLE_ADMIN,'is_staff':True,'is_superuser':True}); user.role=User.ROLE_ADMIN; user.is_staff=True; user.is_superuser=True; user.email=user.email or 'admin@savanex.local'; user.set_password('admin123'); user.save(); print('SAVANEX admin ready')"
  }

  @{
    preparedAt = (Get-Date).ToString('o')
    orbitDatabaseUrl = $orbitDatabaseUrl
    eduPayDatabaseUrl = $eduPayDatabaseUrl
    note = 'Created by start-ecosystem.ps1 after successful local database preparation.'
  } | ConvertTo-Json | Set-Content -Path $preparationMarkerPath -Encoding UTF8
}

$orbitOrganizationId = Get-OrbitOrganizationId
if ([string]::IsNullOrWhiteSpace($orbitOrganizationId)) {
  throw 'Could not resolve the Orbit organization ID.'
}

$eduSyncApiPort = Resolve-EduSyncApiPort -PreferredPort $eduSyncPreferredApiPort -FallbackPorts $eduSyncFallbackApiPorts
$eduSyncApiUrl = "http://localhost:$eduSyncApiPort/api/v1"

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
) -Port 4500 -LogName 'kcs-orbit-api.log'

Start-ServiceWindow -Title 'KCS Nexus Backend' -Command (
  "Set-Location '$kcsNexusBackendPath'; " +
  "`$env:KCS_ORBIT_API_URL='$orbitUrl'; " +
  "`$env:KCS_ORBIT_API_KEY='$($integrationKeys.KcsNexus)'; " +
  "`$env:KCS_ORBIT_ORGANIZATION_ID='$orbitOrganizationId'; " +
  "npm run dev"
) -Port 5000 -LogName 'kcs-nexus-backend.log'

Start-ServiceWindow -Title 'EduPay API' -Command (
  "Set-Location '$eduPayApiPath'; " +
  "`$env:DATABASE_URL='$eduPayDatabaseUrl'; " +
  "`$env:PORT='4000'; " +
  "`$env:KCS_ORBIT_API_URL='$orbitUrl'; " +
  "`$env:KCS_ORBIT_API_KEY='$($integrationKeys.EduPay)'; " +
  "`$env:KCS_ORBIT_ORGANIZATION_ID='$orbitOrganizationId'; " +
  "`$env:FRONTEND_URL='http://localhost:5174'; " +
  "pnpm dev"
) -Port 4000 -LogName 'edupay-api.log'

Start-EduSyncBackend

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
) -Port 8001 -LogName 'savanex-backend.log'

if (-not $NoFrontends) {
  Start-ServiceWindow -Title 'KCS Nexus Frontend' -Command (
    "Set-Location '$kcsNexusFrontendPath'; " +
    "npm run dev -- --host 0.0.0.0 --port 5173"
  ) -Port 5173 -LogName 'kcs-nexus-frontend.log'

  Start-ServiceWindow -Title 'EduPay Web' -Command (
    "Set-Location '$eduPayWebPath'; " +
    "`$env:VITE_API_BASE_URL='http://localhost:4000'; " +
    "pnpm dev -- --host 0.0.0.0 --port 5174"
  ) -Port 5174 -LogName 'edupay-web.log'

  Start-ServiceWindow -Title 'EduSync AI Frontend' -Command (
    "Set-Location '$eduSyncFrontendPath'; " +
    "`$env:VITE_API_URL='$eduSyncApiUrl'; " +
    "npm run dev -- --host 0.0.0.0 --port 5175"
  ) -Port 5175 -LogName 'edusync-ai-frontend.log'

  Start-ServiceWindow -Title 'SAVANEX Frontend' -Command (
    "Set-Location '$savanexFrontendPath'; " +
    "`$env:VITE_API_URL='http://localhost:8001/api'; " +
    "npm run dev -- --host 0.0.0.0 --port 3000"
  ) -Port 3000 -LogName 'savanex-frontend.log'
}

if (-not $NoWait) {
  Write-Step 'Waiting for local services'
  Wait-PortOpen -Name 'Orbit API' -Port 4500 | Out-Null
  Wait-PortOpen -Name 'KCS Nexus API' -Port 5000 | Out-Null
  Wait-PortOpen -Name 'EduPay API' -Port 4000 | Out-Null
  Wait-PortOpen -Name 'EduSync AI API' -Port $eduSyncApiPort | Out-Null
  Wait-PortOpen -Name 'SAVANEX API' -Port 8001 | Out-Null

  if (-not $NoFrontends) {
    Wait-PortOpen -Name 'KCS Nexus frontend' -Port 5173 | Out-Null
    Wait-PortOpen -Name 'EduPay web' -Port 5174 | Out-Null
    Wait-PortOpen -Name 'EduSync AI frontend' -Port 5175 | Out-Null
    Wait-PortOpen -Name 'SAVANEX frontend' -Port 3000 | Out-Null
  }

  Write-Step 'Synchronizing SAVANEX directory into Orbit'
  Invoke-InDirectory -Path $savanexBackendPath -Script {
    $env:DB_ENGINE = 'django.db.backends.sqlite3'
    Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:DB_USER -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DB_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PORT -ErrorAction SilentlyContinue
    $env:KCS_ORBIT_API_URL = $orbitUrl
    $env:KCS_ORBIT_API_KEY = $integrationKeys.Savanex
    $env:KCS_ORBIT_ORGANIZATION_ID = $orbitOrganizationId
    & $savanexPythonPath manage.py sync_orbit_directory
  }
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
Write-Host "EduSync AI API:      http://localhost:$eduSyncApiPort" -ForegroundColor Yellow
Write-Host 'EduSync AI frontend: http://localhost:5175/' -ForegroundColor Yellow
Write-Host 'SAVANEX API:         http://localhost:8001/' -ForegroundColor Yellow
Write-Host 'SAVANEX frontend:    http://localhost:3000/Syst-me-de-gestion-scolaire/' -ForegroundColor Yellow
Write-Host "Orbit organizationId: $orbitOrganizationId" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Useful switches:' -ForegroundColor Cyan
Write-Host '  -FullPreparation          : force Prisma/Django setup even when cached' -ForegroundColor White
Write-Host '  -SkipDatabasePreparation  : relaunch services without Prisma/Django setup' -ForegroundColor White
Write-Host '  -SkipInstall              : skip the EduPay web dependency check' -ForegroundColor White
Write-Host '  -NoFrontends              : launch only backend services' -ForegroundColor White
Write-Host '  -OpenBrowser              : open frontend URLs automatically after launch' -ForegroundColor White
Write-Host '  -AllowEduPayDataLoss      : allow Prisma db push --accept-data-loss for EduPay local reset' -ForegroundColor White
Write-Host '  -Restart                  : stop existing ecosystem services before launch' -ForegroundColor White
Write-Host '  -NoWait                   : do not wait for ports to become ready' -ForegroundColor White
Write-Host "Logs: $logRoot" -ForegroundColor Cyan
