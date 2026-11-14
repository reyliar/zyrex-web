param(
    [string]$PresetId = 'preset-mvng96tn',
    [string]$SourceFolder = 'C:\Users\alkim\Documents\EFFECTS - zyrexediting.xyz\EFFECTS',
    [string]$OutputRoot = '',
    [string]$ReleaseId = ''
)
$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Project '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $Project 'releases' }
if ([string]::IsNullOrWhiteSpace($ReleaseId)) { $ReleaseId = Get-Date -Format 'yyyyMMddHHmmss' }
if (-not (Test-Path -LiteralPath $Python)) { py -3.12 -m venv $Venv }
& $Python -m pip install --upgrade pyinstaller pywebview cryptography pillow
if ($LASTEXITCODE -ne 0) { throw 'Build dependencies could not be installed.' }
& $Python (Join-Path $Project 'build_release.py') --preset-id $PresetId --source $SourceFolder --output-root $OutputRoot --release-id $ReleaseId
if ($LASTEXITCODE -ne 0) { throw 'The session-gated installer could not be built.' }
