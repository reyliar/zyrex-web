[CmdletBinding()]
param(
  [ValidateSet("All", "Api", "SiteGate")]
  [string]$Target = "All",

  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$CommandPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Description
  )

  Write-Host "`n$Description" -ForegroundColor Cyan
  & $CommandPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

$nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  $nodeCommand = Get-Command "node" -ErrorAction SilentlyContinue
}
if (-not $nodeCommand) {
  throw "Node.js is required. Install Node.js and rerun this script."
}

$npxCommand = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
if (-not $npxCommand) {
  throw "npx.cmd was not found. Install Node.js with npm and rerun this script."
}

Push-Location $repoRoot
try {
  # The Discord feed card renders inside the Worker, so its bundle dependencies
  # (satori + resvg wasm) must be installed before wrangler bundles api.js.
  $cardDeploy = Join-Path $repoRoot "node_modules\\@resvg\\resvg-wasm"
  if (($Target -ne "SiteGate") -and -not (Test-Path -LiteralPath $cardDeploy)) {
    $npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if (-not $npmCommand) { throw "npm.cmd was not found; install worker dependencies with npm install." }
    Write-Host "`nInstalling worker dependencies" -ForegroundColor Cyan
    & $npmCommand.Source install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE." }
  }

  $filesToCheck = @()
  if ($Target -ne "SiteGate") {
    $filesToCheck += "workers/api.js"
  }
  if ($Target -ne "Api") {
    $filesToCheck += "workers/site_gate.js"
  }

  foreach ($file in $filesToCheck) {
    $filePath = Join-Path $repoRoot $file
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      throw "Required deployment file is missing: $file"
    }
    Invoke-CheckedCommand -CommandPath $nodeCommand.Source -Arguments @("--check", $filePath) -Description "Checking JavaScript syntax: $file"
  }

  if ($Target -ne "Api") {
    $assetBuilder = Join-Path $repoRoot "scripts\build-site-assets.ps1"
    if (-not (Test-Path -LiteralPath $assetBuilder -PathType Leaf)) {
      throw "Site asset builder is missing: scripts\build-site-assets.ps1"
    }
    Write-Host "`nBuilding Cloudflare site assets..." -ForegroundColor Cyan
    & $assetBuilder

    $optimizer = Join-Path $repoRoot "tools\build-optimizer.js"
    if (-not (Test-Path -LiteralPath $optimizer -PathType Leaf)) {
      throw "Site build optimizer is missing: tools\build-optimizer.js"
    }
    Invoke-CheckedCommand -CommandPath $nodeCommand.Source -Arguments @($optimizer) -Description "Optimizing production site assets"

    $errorMonitor = Join-Path $repoRoot ".site-assets\js\error-monitor.js"
    if (-not (Test-Path -LiteralPath $errorMonitor -PathType Leaf)) {
      throw "Built assets are missing .site-assets\js\error-monitor.js, which site-gate injects into every page."
    }
    Invoke-CheckedCommand -CommandPath $nodeCommand.Source -Arguments @("--check", $errorMonitor) -Description "Checking built client error monitor"
  }

  if ($ValidateOnly) {
    Write-Host "`nValidation completed; no deployment was performed." -ForegroundColor Green
    return
  }

  if ($Target -ne "SiteGate") {
    Invoke-CheckedCommand -CommandPath $npxCommand.Source -Arguments @("--yes", "wrangler", "deploy", "--config", "wrangler.workers.toml") -Description "Deploying zyrex-api"
  }

  if ($Target -ne "Api") {
    Invoke-CheckedCommand -CommandPath $npxCommand.Source -Arguments @("--yes", "wrangler", "deploy", "--config", "wrangler.site-gate.toml") -Description "Deploying zyrex-site-gate"
  }

  Write-Host "`nDeployment completed successfully. Live at https://zyrexediting.xyz" -ForegroundColor Green
}
finally {
  Pop-Location
}
