# ForgeUI continuous implementation loop (PowerShell)
# Usage: .\scripts\forgeui-loop.ps1 [-IntervalSec 60]
#
# IMPORTANT (Cursor Agent):
#   This script only PRINTS wake lines to the terminal. It does NOT invoke the Agent by itself.
#   For semi-auto loop in Cursor:
#     1. Run this script in a Cursor terminal (keep chat open).
#     2. Ask Agent to "monitor loop output" OR use /loop skill with notify_on_output.
#     3. Or say "继续 loop" in chat when you see AGENT_LOOP_WAKE_FORGEUI.
#   Full unattended loop requires Cursor Automations / Cloud Agent (see .cursor/skills-cursor/automate).
#
# Auto-stop:
#   Before each wake, scans docs/IMPLEMENTATION_PROGRESS.md for actionable `- [ ]` / `- [~]`.
#   If none remain, prints AGENT_LOOP_STOP_FORGEUI and exits (no further wakes).

param(
  [int]$IntervalSec = 90
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$progressPath = Join-Path $repoRoot "docs\IMPLEMENTATION_PROGRESS.md"

$prompt = "ForgeUI loop: read docs/IMPLEMENTATION_PROGRESS.md; take first [ ] or [~]; implement + npm test; update docs. If no actionable [ ]/[~] remain (only [-] deferred), stop this loop (kill forgeui-loop.ps1) and do not re-arm."

function Test-ForgeUiQueueEmpty {
  if (-not (Test-Path -LiteralPath $progressPath)) { return $false }
  $text = Get-Content -LiteralPath $progressPath -Raw -ErrorAction SilentlyContinue
  if (-not $text) { return $false }
  # Actionable checklist items only (not completed [x] or deferred [-])
  return -not [regex]::IsMatch($text, '(?m)^-\s*\[(\s|~)\]')
}

Write-Host "ForgeUI loop | interval=${IntervalSec}s | Ctrl+C to stop"
Write-Host "Wake sentinel: AGENT_LOOP_WAKE_FORGEUI"
Write-Host "Stop sentinel:  AGENT_LOOP_STOP_FORGEUI (auto when queue empty)"
Write-Host "Prompt: $prompt"
Write-Host ""
Write-Host "Note: Agent must be running in Cursor chat to act on each tick."

if (Test-ForgeUiQueueEmpty) {
  Write-Output 'AGENT_LOOP_STOP_FORGEUI {"reason":"no actionable [ ] or [~] in IMPLEMENTATION_PROGRESS.md","prompt":"ForgeUI queue empty - loop stopped."}'
  Write-Host "Queue already empty - exiting without waking."
  exit 0
}

while ($true) {
  Start-Sleep -Seconds $IntervalSec
  if (Test-ForgeUiQueueEmpty) {
    Write-Output 'AGENT_LOOP_STOP_FORGEUI {"reason":"no actionable [ ] or [~] in IMPLEMENTATION_PROGRESS.md","prompt":"ForgeUI queue empty - loop stopped."}'
    Write-Host "Queue empty - auto-stopping ForgeUI loop."
    exit 0
  }
  $payload = @{ prompt = $prompt } | ConvertTo-Json -Compress
  Write-Output "AGENT_LOOP_WAKE_FORGEUI $payload"
}
