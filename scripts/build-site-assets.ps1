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

$publicFiles = @()
$publicFiles += Get-ChildItem -LiteralPath $repoRoot -File -Filter "*.html"
foreach ($relativePath in @("_headers", "_redirects", "favicon.ico")) {
  $source = Join-Path $repoRoot $relativePath
  if (Test-Path -LiteralPath $source -PathType Leaf) {
    $publicFiles += Get-Item -LiteralPath $source
  }
}

foreach ($relativeDirectory in @("assets", "css", "js", "plugins")) {
  $sourceDirectory = Join-Path $repoRoot $relativeDirectory
  if (Test-Path -LiteralPath $sourceDirectory -PathType Container) {
    $publicFiles += Get-ChildItem -LiteralPath $sourceDirectory -File -Recurse
  }
}

foreach ($sourceFile in $publicFiles) {
  $relativePath = $sourceFile.FullName.Substring($repoRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $destination = Join-Path $outputDir $relativePath
  $destinationParent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  Copy-Item -LiteralPath $sourceFile.FullName -Destination $destination
}

$assetCount = (Get-ChildItem -LiteralPath $outputDir -Recurse -File).Count
Write-Output "Prepared $assetCount public assets in $outputDir"
