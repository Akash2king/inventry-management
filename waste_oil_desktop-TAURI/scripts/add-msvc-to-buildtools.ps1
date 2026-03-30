# Adds the C++ workload to an existing Visual Studio 2022 Build Tools install.
# Run PowerShell as Administrator. winget cannot do this once Build Tools is already installed without MSVC.
$ErrorActionPreference = 'Stop'

function Test-ValidInstallPath([string] $p) {
  if ([string]::IsNullOrWhiteSpace($p)) { return $false }
  $t = $p.Trim()
  if ($t -match '^(Error|ERROR)\b') { return $false }
  if ($t -notmatch '^[A-Za-z]:\\') { return $false }
  return (Test-Path -LiteralPath $t -PathType Container)
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$setup = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\setup.exe'

if (-not (Test-Path -LiteralPath $vswhere) -or -not (Test-Path -LiteralPath $setup)) {
  Write-Host 'vswhere.exe or setup.exe not found. Install Visual Studio Installer first.' -ForegroundColor Red
  exit 1
}

$raw = @(& $vswhere -products Microsoft.VisualStudio.Product.BuildTools -property installationPath -nologo 2>$null)
$installPath = $null
foreach ($line in $raw) {
  if (Test-ValidInstallPath $line) {
    $installPath = $line.Trim()
    break
  }
}

if (-not $installPath) {
  Write-Host @'
Could not find Visual Studio 2022 Build Tools installation path.

If you use full Visual Studio (Community, etc.), open Visual Studio Installer,
click Modify, and enable "Desktop development with C++" instead.
'@ -ForegroundColor Red
  exit 1
}

Write-Host "Build Tools install path: $installPath"
Write-Host 'Launching installer to add C++ workload (passive UI).'

# Start-Process -ArgumentList breaks paths at spaces on Windows PowerShell 5.1 (installPath becomes C:\Program only).
$pathForCmd = $installPath.Replace('"', '\"')
$argumentString = "modify --installPath `"$pathForCmd`" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive --norestart"

$elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $setup
$psi.Arguments = $argumentString
$psi.UseShellExecute = $true
if (-not $elevated) {
  Write-Host 'UAC: passive VS Installer must run as Administrator. Approve the prompt.' -ForegroundColor Yellow
  $psi.Verb = 'runas'
}

$process = [System.Diagnostics.Process]::Start($psi)
$process.WaitForExit()
exit $process.ExitCode
