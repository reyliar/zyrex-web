# Zyrex Web — Deploy Script (PowerShell)
# Run this script to sync .site-assets and deploy everything at once.

# Sync HTML, JS, CSS, Assets, Plugins, _headers, _redirects to .site-assets
Write-Host "Syncing site files and folders to .site-assets..." -ForegroundColor Cyan

Get-ChildItem -Path . -Filter "*.html" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination ".site-assets\$($_.Name)" -Force
}

@("js", "css", "assets", "plugins") | ForEach-Object {
    if (Test-Path $_) {
        Copy-Item -Path $_ -Destination ".site-assets" -Recurse -Force
        Write-Host "  Synced folder: $_" -ForegroundColor Green
    }
}

@("_headers", "_redirects", "favicon.ico") | ForEach-Object {
    if (Test-Path $_) {
        Copy-Item -Path $_ -Destination ".site-assets\$_" -Force
        Write-Host "  Synced file: $_" -ForegroundColor Green
    }
}
Write-Host "  All site assets synced successfully!" -ForegroundColor Green

# Deploy zyrex-api worker (scan-creator-links, scrape, etc.)
Write-Host "`nDeploying zyrex-api worker..." -ForegroundColor Cyan
npx wrangler deploy --config wrangler.workers.toml

# Deploy zyrex-site-gate (serves the HTML files to zyrexediting.xyz)
Write-Host "`nDeploying zyrex-site-gate..." -ForegroundColor Cyan
npx wrangler deploy --config wrangler.site-gate.toml

Write-Host "`nAll deployed! Live at: https://zyrexediting.xyz" -ForegroundColor Green
