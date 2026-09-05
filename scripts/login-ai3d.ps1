$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot ".tools\python311\python.exe"
$huggingFaceCli = Join-Path $projectRoot ".tools\python311\Scripts\huggingface-cli.exe"

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Local AI runtime is missing. Run scripts\setup-ai3d.ps1 first."
}

Write-Host "A browser token with read access is required. Do not paste it into BrickForge or commit it to Git."
& $huggingFaceCli login
