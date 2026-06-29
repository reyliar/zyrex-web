# Zyrex File API Server Service Installer
# Creates a Windows Scheduled Task to run the file API server at startup
# Run this script as Administrator

param(
    [string]$TaskName = "ZyrexFileAPIServer",
    [string]$ScriptDir = $PSScriptRoot
)

# Resolve paths
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ServerScript = Join-Path $ProjectRoot "scratch\file_api_server.py"
$LogFile = Join-Path $ProjectRoot "scratch\file_api.log"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please restart PowerShell as Administrator and run this script again." -ForegroundColor Yellow
    exit 1
}

# Validate
if (-not (Test-Path $VenvPython)) {
    Write-Error "Python not found at $VenvPython. Make sure the virtual environment is set up."
    exit 1
}
if (-not (Test-Path $ServerScript)) {
    Write-Error "Server script not found at $ServerScript"
    exit 1
}

Write-Host "Installing Zyrex File API Server as scheduled task..." -ForegroundColor Cyan
Write-Host "  Python: $VenvPython" -ForegroundColor Gray
Write-Host "  Script: $ServerScript" -ForegroundColor Gray
Write-Host "  Log:    $LogFile" -ForegroundColor Gray

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task '$TaskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the scheduled task action
$Action = New-ScheduledTaskAction `
    -Execute $VenvPython `
    -Argument "`"$ServerScript`"" `
    -WorkingDirectory $ProjectRoot

# Set environment variables for the task
# Redirect output to log file
$Action = New-ScheduledTaskAction `
    -Execute $VenvPython `
    -Argument "`"$ServerScript`" >> `"$LogFile`" 2>&1" `
    -WorkingDirectory $ProjectRoot

# Settings: auto-restart on failure, no time limit
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit 0 `
    -Priority 5 `
    -MultipleInstances IgnoreNew

# Run at system startup
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Also run now (once)
$TriggerNow = New-ScheduledTaskTrigger -At (Get-Date).AddSeconds(10) -Once

# Run as SYSTEM account (runs even when no user is logged in)
$Principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Settings $Settings `
        -Trigger $Trigger, $TriggerNow `
        -Principal $Principal `
        -Description "Zyrex File API Server - Serves SFTPGo file listings and download tokens on port 8081" `
        -Force

    Write-Host "`nSchedule task '$TaskName' installed successfully!" -ForegroundColor Green
    Write-Host "The server will start within 10 seconds and run at every system startup." -ForegroundColor Yellow
    
    # Start the task immediately
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Task started. Check $LogFile for output." -ForegroundColor Gray
} catch {
    Write-Error "Failed to install scheduled task: $_"
    exit 1
}

# Show status
Write-Host "`n--- Task Status ---" -ForegroundColor Cyan
Get-ScheduledTask -TaskName $TaskName | Format-List TaskName, State, Description
Write-Host "To stop:  Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "To check: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
