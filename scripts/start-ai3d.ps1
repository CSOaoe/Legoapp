$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot ".tools\python311\python.exe"
$engineRoot = Join-Path $projectRoot ".tools\stable-fast-3d"

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Local AI runtime is missing. Run scripts\setup-ai3d.ps1 first."
}
if (-not (Test-Path -LiteralPath $engineRoot)) {
  throw "Stable Fast 3D is missing. Run scripts\setup-ai3d.ps1 first."
}

Set-Location -LiteralPath $projectRoot
& $pythonExe -c "import sys; sys.path[:0] = [r'$projectRoot', r'$engineRoot']; import uvicorn; uvicorn.run('services.image_to_3d.app:app', host='127.0.0.1', port=8787, log_level='info')"
