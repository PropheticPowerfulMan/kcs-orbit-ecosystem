param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowTitlePrefix = 'Ecosystem | '
$servicePorts = @(3000, 4000, 4500, 5000, 5001, 5173, 5174, 5175, 5176, 8000, 8001, 8010, 8011, 8012)
$stoppedItems = New-Object System.Collections.Generic.List[string]

function Write-Step {
  param([string]$Message)

  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Stop-TrackedWindowProcesses {
  $windowProcesses = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "$windowTitlePrefix*"
  }

  foreach ($process in $windowProcesses) {
    $label = if ($process.MainWindowTitle) { $process.MainWindowTitle } else { "PowerShell $($process.Id)" }
    if ($Force) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    else {
      Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
    }
    $stoppedItems.Add($label) | Out-Null
  }
}

function Get-ProtectedProcessIds {
  $protected = New-Object System.Collections.Generic.HashSet[int]
  $currentId = $PID
  $protected.Add($currentId) | Out-Null

  try {
    $processLookup = @{}
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
      $processLookup[[int]$_.ProcessId] = $_
    }

    $cursor = $processLookup[$currentId]
    while ($cursor -and $cursor.ParentProcessId) {
      $parentId = [int]$cursor.ParentProcessId
      if (-not $protected.Add($parentId)) {
        break
      }
      $cursor = $processLookup[$parentId]
    }
  }
  catch {
    # If CIM is restricted, protecting the current process is still enough for port cleanup.
  }

  return $protected
}

function Stop-WorkspaceProcesses {
  $protected = Get-ProtectedProcessIds
  $repoPattern = "*$repoRoot*"
  $candidateNames = @('node.exe', 'python.exe', 'powershell.exe', 'cmd.exe')

  try {
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.CommandLine -and
      $_.CommandLine -like $repoPattern -and
      $_.Name -in $candidateNames -and
      -not $protected.Contains([int]$_.ProcessId)
    }
  }
  catch {
    return
  }

  foreach ($processInfo in $processes) {
    $processId = [int]$processInfo.ProcessId
    $label = "$($processInfo.Name) pid=$processId workspace"

    if ($Force) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    else {
      Stop-Process -Id $processId -ErrorAction SilentlyContinue
    }
    $stoppedItems.Add($label) | Out-Null
  }
}

function Stop-ProcessesByPort {
  foreach ($port in $servicePorts) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
      continue
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
      if (-not $processId -or $processId -le 0) {
        continue
      }

      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if (-not $process) {
        continue
      }

      $label = "$($process.ProcessName) pid=$processId port=$port"
      if ($Force) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      }
      else {
        Stop-Process -Id $processId -ErrorAction SilentlyContinue
      }
      $stoppedItems.Add($label) | Out-Null
    }
  }
}

Write-Step 'Stopping ecosystem PowerShell windows'
Stop-TrackedWindowProcesses

Start-Sleep -Milliseconds 300

Write-Step 'Stopping remaining workspace dev processes'
Stop-WorkspaceProcesses

Start-Sleep -Milliseconds 300

Write-Step 'Stopping any remaining listeners on ecosystem ports'
Stop-ProcessesByPort

Write-Host ''
if ($stoppedItems.Count -eq 0) {
  Write-Host 'No running ecosystem services were found.' -ForegroundColor Yellow
}
else {
  Write-Host 'Stopped services/windows:' -ForegroundColor Green
  $stoppedItems | Sort-Object -Unique | ForEach-Object {
    Write-Host "  - $_" -ForegroundColor White
  }
}

Write-Host ''
Write-Host 'Ports checked: 3000, 4000, 4500, 5000, 5001, 5173, 5174, 5175, 5176, 8000, 8001, 8010, 8011, 8012' -ForegroundColor Cyan
