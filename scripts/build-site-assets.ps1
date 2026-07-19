$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$outputDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ".site-assets"))
$expectedOutput = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ".site-assets"))

if ($outputDir -ne $expectedOutput -or -not $outputDir.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar)) {
  throw "Refusing to rebuild an output directory outside the repository."
}

if (Test-Path -LiteralPath $outputDir) {
  Remove-Item -LiteralPath $outputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $outputDir | Out-Null

Push-Location $repoRoot
try {
  $publicFiles = @(
    git ls-files -- "*.html" "favicon.ico" "_headers" "_redirects" "assets/**" "css/**" "js/*.js" "plugins/**"
  ) | Sort-Object -Unique
  if ($LASTEXITCODE -ne 0) {
    throw "git ls-files failed while preparing public assets."
  }
} finally {
  Pop-Location
}

foreach ($relativePath in $publicFiles) {
  $source = Join-Path $repoRoot $relativePath
  $destination = Join-Path $outputDir $relativePath
  $destinationParent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}

$assetCount = (Get-ChildItem -LiteralPath $outputDir -Recurse -File).Count
Write-Output "Prepared $assetCount public assets in $outputDir"
