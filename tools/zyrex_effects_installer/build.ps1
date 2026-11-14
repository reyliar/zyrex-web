param(
    [string]$PresetId = 'preset-mvng96tn',
    [string]$SourceFolder = 'C:\Users\alkim\Documents\EFFECTS - zyrexediting.xyz\EFFECTS',
    [string]$OutputRoot = ''
)
$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Project '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $Project 'releases' }

if (-not (Test-Path -LiteralPath $Python)) { py -3.12 -m venv $Venv }
& $Python -m pip install pyinstaller pywebview
if ($LASTEXITCODE -ne 0) { throw 'Build dependencies could not be installed.' }
$SiteProduct = Invoke-RestMethod -Uri "https://zyrexediting.xyz/api/products?id=$([uri]::EscapeDataString($PresetId))" -TimeoutSec 20
if (-not $SiteProduct.id -or $SiteProduct.id -ne $PresetId) { throw "Leak ID was not found on Zyrex: $PresetId" }
$LeakName = [string]$SiteProduct.name
$LeakName = [regex]::Replace($LeakName, '[<>:"/\\|?*\x00-\x1f]', ' ').Trim(' ', '.')
if ([string]::IsNullOrWhiteSpace($LeakName)) { throw 'Leak name is not a valid output filename.' }
$ReleaseDirectory = Join-Path (Join-Path $OutputRoot 'Windows') $LeakName
New-Item -ItemType Directory -Path $ReleaseDirectory -Force | Out-Null
$PayloadPath = Join-Path $Project 'payload.zip'
& $Python (Join-Path $Project 'build_payload.py') --preset-id $PresetId --source $SourceFolder --payload $PayloadPath
if ($LASTEXITCODE -ne 0) { throw 'FFX payload creation failed.' }
$BuildWork = Join-Path $Project (Join-Path 'build' $PresetId)
$StagingDirectory = Join-Path $Project (Join-Path 'staging' $PresetId)
New-Item -ItemType Directory -Path $StagingDirectory -Force | Out-Null
& $Python -m PyInstaller --noconfirm --clean --onefile --windowed --name $LeakName --distpath $StagingDirectory --workpath $BuildWork --specpath $BuildWork --add-data "$PayloadPath;." --add-data "$(Join-Path $Project 'ui.html');." --add-data "$(Join-Path $Project 'content.png');." --add-data "$(Join-Path $Project 'outfit-latin.woff2');." --add-data "$(Join-Path $Project 'outfit-latin-ext.woff2');." (Join-Path $Project 'app.py')
if ($LASTEXITCODE -ne 0) { throw 'The single-file installer could not be built.' }
$StagedExe = Join-Path $StagingDirectory "$LeakName.exe"
$FinalExe = Join-Path $ReleaseDirectory "$LeakName.exe"
Copy-Item -LiteralPath $StagedExe -Destination $FinalExe -Force
Set-Content -LiteralPath (Join-Path $ReleaseDirectory 'Leaked by Zyrex.txt') -Value 'Leaked by Zyrex' -Encoding utf8
Set-Content -LiteralPath (Join-Path $ReleaseDirectory 'Visit for more resources.url') -Value "[InternetShortcut]`r`nURL=https://zyrexediting.xyz/leaks`r`n" -Encoding ascii
$Expected = @("$LeakName.exe", 'Leaked by Zyrex.txt', 'Visit for more resources.url')
$Actual = @(Get-ChildItem -LiteralPath $ReleaseDirectory -File | Select-Object -ExpandProperty Name)
foreach ($File in $Expected) { if ($File -notin $Actual) { throw "Release output is missing: $File" } }
if ($Actual.Count -ne 3) { throw "Release directory must contain only the app and two resource shortcuts; found $($Actual.Count) files." }
Write-Host "Built release folder: $ReleaseDirectory"
