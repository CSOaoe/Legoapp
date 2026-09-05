$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot ".tools"
$pythonRoot = Join-Path $toolsRoot "python311"
$pythonExe = Join-Path $pythonRoot "python.exe"
$engineRoot = Join-Path $toolsRoot "stable-fast-3d"
$pythonVersion = "3.11.9"
$engineCommit = "ff21fc491b4dc5314bf6734c7c0dabd86b5f5bb2"

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null

if (-not (Test-Path -LiteralPath $pythonExe)) {
  $embedZip = Join-Path $toolsRoot "python-$pythonVersion-embed-amd64.zip"
  $nugetFile = Join-Path $toolsRoot "python-$pythonVersion.nupkg"
  $nugetZip = Join-Path $toolsRoot "python-$pythonVersion-nuget.zip"
  $nugetRoot = Join-Path $toolsRoot "python-$pythonVersion-nuget"
  Invoke-WebRequest "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-embed-amd64.zip" -OutFile $embedZip
  Expand-Archive -LiteralPath $embedZip -DestinationPath $pythonRoot -Force
  (Get-Content (Join-Path $pythonRoot "python311._pth")) -replace '#import site', 'import site' | Set-Content (Join-Path $pythonRoot "python311._pth")
  Invoke-WebRequest "https://bootstrap.pypa.io/get-pip.py" -OutFile (Join-Path $toolsRoot "get-pip.py")
  & $pythonExe (Join-Path $toolsRoot "get-pip.py")
  Invoke-WebRequest "https://www.nuget.org/api/v2/package/python/$pythonVersion" -OutFile $nugetFile
  Copy-Item -LiteralPath $nugetFile -Destination $nugetZip -Force
  Expand-Archive -LiteralPath $nugetZip -DestinationPath $nugetRoot -Force
  Copy-Item -LiteralPath (Join-Path $nugetRoot "tools\include") -Destination (Join-Path $pythonRoot "include") -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $nugetRoot "tools\libs") -Destination (Join-Path $pythonRoot "libs") -Recurse -Force
}

if (-not (Test-Path -LiteralPath $engineRoot)) {
  git clone --filter=blob:none https://github.com/Stability-AI/stable-fast-3d.git $engineRoot
}
git -C $engineRoot checkout $engineCommit
$windowsPatch = Join-Path $projectRoot "services\image_to_3d\windows-msvc.patch"
git -C $engineRoot apply --check $windowsPatch 2>$null
if ($LASTEXITCODE -eq 0) { git -C $engineRoot apply $windowsPatch }

& $pythonExe -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
& $pythonExe -m pip install -r (Join-Path $projectRoot "services\image_to_3d\requirements.txt")

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsRoot = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsRoot) { throw "Visual Studio C++ build tools are required." }
$vsDevCmd = Join-Path $vsRoot "Common7\Tools\VsDevCmd.bat"
$cl = Get-ChildItem (Join-Path $vsRoot "VC\Tools\MSVC") -Recurse -Filter cl.exe | Where-Object FullName -like '*Hostx64\x64\cl.exe' | Select-Object -First 1
$rc = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter rc.exe | Where-Object FullName -like '*\x64\rc.exe' | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $cl -or -not $rc) { throw "MSVC compiler or Windows SDK resource compiler was not found." }
$nativePath = "$(Split-Path $cl.FullName);$(Split-Path $rc.FullName)"
$pythonCode = "import os; os.environ['PATH']=r'$nativePath;'+os.environ['PATH']; from pip._internal.cli.main import main; raise SystemExit(main(['install',r'.\texture_baker',r'.\uv_unwrapper','--no-build-isolation']))"
$buildCommand = "call `"$vsDevCmd`" -arch=x64 -host_arch=x64 && set DISTUTILS_USE_SDK=1 && `"$pythonExe`" -c `"$pythonCode`""
Push-Location $engineRoot
try { & cmd.exe /d /s /c $buildCommand }
finally { Pop-Location }

Write-Host "Local AI runtime installed. Accept the Stable Fast 3D licence, run scripts\login-ai3d.ps1, then scripts\start-ai3d.ps1."
