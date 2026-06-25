# Zyrex Bot Service Installer
# Creates a Windows Scheduled Task to run the bot at startup

param(
    [Parameter(Mandatory=$true)]
    [string]$BotToken,
    
    [string]$TaskName = "ZyrexDiscordBot",
    [string]$ScriptDir = $PSScriptRoot
)

# Resolve paths
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$BotScript = Join-Path $ScriptDir "zyrex_bot.py"
$LogFile = Join-Path $ScriptDir "bot.log"

# Validate
if (-not (Test-Path $VenvPython)) {
    Write-Error "Python not found at $VenvPython. Activate virtual environment first."
    exit 1
}
if (-not (Test-Path $BotScript)) {
    Write-Error "Bot script not found at $BotScript"
    exit 1
}

# Create the scheduled task action
$Action = New-ScheduledTaskAction `
    -Execute $VenvPython `
    -Argument "`"$BotScript`"" `
    -WorkingDirectory $ProjectRoot

# Set environment variables for the task
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit 0 `
    -Priority 5

# Run at system startup
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Run as current user but with highest privileges
$Principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Register the task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Zyrex Discord Bot - Always online in DND mode" `
    -Force

# Also set the environment variable for the task
$task = Get-ScheduledTask -TaskName $TaskName
$task | Set-ScheduledTask -MultipleSettings $Settings

Write-Output "✅ Task '$TaskName' created successfully!"
Write-Output "   Bot will start automatically at system startup."
Write-Output ""
Write-Output "To start immediately, run:"
Write-Output "   Start-ScheduledTask -TaskName '$TaskName'"
Write-Output ""
Write-Output "To stop:"
Write-Output "   Stop-ScheduledTask -TaskName '$TaskName'"
Write-Output ""
Write-Output "To uninstall:"
Write-Output "   Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
