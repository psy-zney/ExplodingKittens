$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
& agy --mode accept-edits --prompt-interactive 'Read AGY_HANDOFF.md and docs/TEST_REPORT.md. Continue only concrete unfinished tasks; preserve the verified production deployment. Use normal permissions, do not bypass approvals, do not print secrets, and avoid restarting services during active games or tests. Verify changes with relevant tests before deploying.'
