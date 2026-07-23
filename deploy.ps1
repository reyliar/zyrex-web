# Zyrex Web — Deploy Script (PowerShell)
# Run this script to sync .site-assets and deploy everything at once.

# Sync all HTML files from root to .site-assets
Write-Host "Syncing HTML files to .site-assets..." -ForegroundColor Cyan
Get-ChildItem -Path . -Filter "*.html" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination ".site-assets\$($_.Name)" -Force
    Write-Host "  Synced $($_.Name)" -ForegroundColor Green
}

# Deploy zyrex-api worker (scan-creator-links, scrape, etc.)
Write-Host "`nDeploying zyrex-api worker..." -ForegroundColor Cyan
npx wrangler deploy --config wrangler.workers.toml

# Deploy zyrex-site-gate (serves the HTML files to zyrexediting.xyz)
Write-Host "`nDeploying zyrex-site-gate..." -ForegroundColor Cyan
npx wrangler deploy --config wrangler.site-gate.toml

Write-Host "`nAll deployed! Live at: https://zyrexediting.xyz" -ForegroundColor Green
