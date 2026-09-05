$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot ".tools\python311\python.exe"
$huggingFaceCli = Join-Path $projectRoot ".tools\python311\Scripts\huggingface-cli.exe"

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Local AI runtime is missing. Run scripts\setup-ai3d.ps1 first."
}

Write-Host "A browser token with read access is required. Do not paste it into BrickForge or commit it to Git."
& $huggingFaceCli login
if ($LASTEXITCODE -ne 0) { throw "Hugging Face login failed." }

Write-Host "Downloading Stable Fast 3D and its image encoder. This requires several gigabytes."
& $pythonExe -X utf8 -m huggingface_hub.commands.huggingface_cli download stabilityai/stable-fast-3d --include config.yaml model.safetensors
if ($LASTEXITCODE -ne 0) { throw "Stable Fast 3D download failed." }
& $pythonExe -X utf8 -m huggingface_hub.commands.huggingface_cli download facebook/dinov2-large --include config.json preprocessor_config.json model.safetensors
if ($LASTEXITCODE -ne 0) { throw "DINOv2 encoder download failed." }
& $pythonExe -X utf8 -m huggingface_hub.commands.huggingface_cli download laion/CLIP-ViT-B-32-laion2B-s34B-b79K --include open_clip_pytorch_model.bin
if ($LASTEXITCODE -ne 0) { throw "CLIP estimator download failed." }

$env:U2NET_HOME = Join-Path $projectRoot ".tools\u2net"
Write-Host "Downloading the local background-removal model."
& $pythonExe -X utf8 -c "import rembg; rembg.new_session(); print('Background-removal model ready')"
if ($LASTEXITCODE -ne 0) { throw "Background-removal model download failed." }
