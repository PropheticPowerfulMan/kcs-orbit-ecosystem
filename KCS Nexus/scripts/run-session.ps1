param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
  [string[]]$Command,
  [string]$CommitMessage
)

$ErrorActionPreference = "Stop"
$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot

try {
  if ($Command.Length -eq 1) {
    & $Command[0]
  }
  else {
    & $Command[0] $Command[1..($Command.Length - 1)]
  }
}
finally {
  if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    & "$PSScriptRoot\session-commit.ps1"
  }
  else {
    & "$PSScriptRoot\session-commit.ps1" -Message $CommitMessage
  }
}
