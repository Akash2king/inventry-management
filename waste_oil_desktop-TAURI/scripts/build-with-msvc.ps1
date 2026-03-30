# Loads MSVC (vcvars64) then runs the Tauri CLI directly — avoids npm -> run-tauri -> this script recursion.
param(
  [Parameter(Position = 0)]
  [ValidateSet('build', 'dev')]
  [string] $Target = 'build'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Write-Error "Could not find package.json next to scripts/. Run from waste_oil_desktop-TAURI."
  exit 1
}
Set-Location $root

function Get-VcVars64Bat {
  param([string] $VsWhereExe)

  function Test-ValidVsInstallRoot([string] $p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return $false }
    $t = $p.Trim()
    if ($t -match '^(Error|ERROR)\b') { return $false }
    if ($t -notmatch '^[A-Za-z]:\\') { return $false }
    return (Test-Path -LiteralPath $t -PathType Container)
  }

  function Invoke-VsWhereInstallPaths {
    param([string[]] $VsWhereArgs)
    try {
      $out = & $VsWhereExe @VsWhereArgs 2>$null
    } catch {
      return @()
    }
    $paths = @()
    foreach ($line in $out) {
      if (-not (Test-ValidVsInstallRoot $line)) { continue }
      $paths += $line.Trim()
    }
    return $paths
  }

  if (Test-Path -LiteralPath $VsWhereExe) {
    foreach ($vwArgs in @(
        @('-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath', '-nologo'),
        @('-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath', '-nologo'),
        @('-latest', '-products', '*', '-property', 'installationPath', '-nologo'),
        @('-products', '*', '-property', 'installationPath', '-nologo')
      )) {
      foreach ($p in (Invoke-VsWhereInstallPaths -VsWhereArgs $vwArgs)) {
        $c = Join-Path $p 'VC\Auxiliary\Build\vcvars64.bat'
        if (Test-Path -LiteralPath $c) { return $c }
      }
    }
  }
  foreach ($base in @(${env:ProgramFiles(x86)}, ${env:ProgramFiles})) {
    foreach ($rel in @(
        'Microsoft Visual Studio\2022\BuildTools',
        'Microsoft Visual Studio\2022\Community',
        'Microsoft Visual Studio\2022\Professional',
        'Microsoft Visual Studio\2022\Enterprise',
        'Microsoft Visual Studio\2022\Preview\Community',
        'Microsoft Visual Studio\2022\Preview\Professional',
        'Microsoft Visual Studio\2022\Preview\Enterprise',
        'Microsoft Visual Studio\2019\BuildTools',
        'Microsoft Visual Studio\2019\Community',
        'Microsoft Visual Studio\2019\Professional',
        'Microsoft Visual Studio\2019\Enterprise'
      )) {
      $c = Join-Path $base ($rel + '\VC\Auxiliary\Build\vcvars64.bat')
      if (Test-Path $c) { return $c }
    }
  }
  return $null
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$vcvars = Get-VcVars64Bat -VsWhereExe $vswhere

if (-not $vcvars) {
  if (-not (Test-Path $vswhere)) {
    Write-Host @'
Visual Studio Installer not found (vswhere.exe missing).

Install Build Tools with the C++ workload:

  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

https://visualstudio.microsoft.com/visual-cpp-build-tools/
'@ -ForegroundColor Red
  } else {
    Write-Host @'
MSVC is not installed (vcvars64.bat missing). Rust on Windows needs the MSVC C++ toolchain (link.exe).

If winget says Build Tools is already installed but vcvars64.bat is still missing, the C++ workload was never added.
winget upgrade does NOT add workloads. Do one of the following:

  A) Start menu -> Visual Studio Installer -> Modify Build Tools 2022 ->
     enable "Desktop development with C++" or the MSVC v143 + Windows SDK components, then Install.

  B) From waste_oil_desktop-TAURI, run as Administrator:
     npm run add-msvc

  (That runs scripts/add-msvc-to-buildtools.ps1 to attach Microsoft.VisualStudio.Workload.VCTools.)

Fresh install (no Build Tools yet), elevated PowerShell:
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

Then run: npm run build
'@ -ForegroundColor Red
    Write-Host ''
    Write-Host '--- Detected Visual Studio installs (vswhere) ---' -ForegroundColor DarkGray
    try {
      $lines = & $vswhere -products * -property installationPath -nologo 2>$null
      if (-not $lines) {
        Write-Host '  (none reported)' -ForegroundColor DarkGray
      } else {
        foreach ($line in $lines) {
          if ([string]::IsNullOrWhiteSpace($line)) { continue }
          $bat = Join-Path $line.Trim() 'VC\Auxiliary\Build\vcvars64.bat'
          $ok = Test-Path -LiteralPath $bat
          $flag = if ($ok) { '[OK]' } else { '[no MSVC]' }
          Write-Host "  $flag $line" -ForegroundColor $(if ($ok) { 'Green' } else { 'Yellow' })
        }
      }
    } catch {
      Write-Host "  (vswhere failed: $_)" -ForegroundColor DarkGray
    }
    Write-Host '---' -ForegroundColor DarkGray
  }
  exit 1
}

$sub = if ($Target -eq 'dev') { 'dev' } else { 'build' }
$tauriJs = Join-Path $root 'node_modules\@tauri-apps\cli\tauri.js'
if (-not (Test-Path $tauriJs)) {
  Write-Host "Run npm install in $root first." -ForegroundColor Red
  exit 1
}
$cmd = "call `"$vcvars`" >nul && cd /d `"$root`" && node `"$tauriJs`" $sub"
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $cmd) -NoNewWindow -Wait -PassThru
exit $proc.ExitCode
