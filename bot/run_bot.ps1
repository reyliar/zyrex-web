# Zyrex Bot - Silent Launcher
# This script runs the bot silently in the background.

$env:DISCORD_BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
$env:GUILD_ID = "1518954946110685184"

$venvPath = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$botScript = Join-Path $PSScriptRoot "zyrex_bot.py"

if (-not (Test-Path $venvPath)) {
    Write-Error "Virtual environment Python not found at $venvPath"
    exit 1
}

# Run bot with hidden window
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $venvPath
$psi.Arguments = "`"$botScript`""
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables["DISCORD_BOT_TOKEN"] = $env:DISCORD_BOT_TOKEN
$psi.EnvironmentVariables["GUILD_ID"] = $env:GUILD_ID

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi
$process.Start() | Out-Null

Write-Output "Bot started with PID: $($process.Id)"
Write-Output "Log file: $(Join-Path $PSScriptRoot 'bot.log')"
