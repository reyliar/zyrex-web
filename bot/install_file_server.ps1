# Zyrex File API Server Service Installer
# Creates a Windows Scheduled Task to run the file API server at startup
# Run via install_file_server.bat (which auto-elevates and bypasses execution policy)

param(
    [string]$TaskName = "ZyrexFileAPIServer"
)

# Resolve paths
$ScriptDir = $PSScriptRoot
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ServerScript = Join-Path $ProjectRoot "scratch\file_api_server.py"
$LogFile = Join-Path $ProjectRoot "scratch\file_api.log"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Use install_file_server.bat instead (auto-elevates)." -ForegroundColor Yellow
    exit 1
}

# Validate
if (-not (Test-Path $VenvPython)) {
    Write-Error "Python not found at $VenvPython. Run: python -m venv .venv"
    exit 1
}
if (-not (Test-Path $ServerScript)) {
    Write-Error "Server script not found at $ServerScript"
    exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Zyrex File API Server - Service Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Python:  $VenvPython" -ForegroundColor Gray
Write-Host "  Script:  $ServerScript" -ForegroundColor Gray
Write-Host "  Log:     $LogFile" -ForegroundColor Gray
Write-Host "  Port:    8081 (localhost)" -ForegroundColor Gray
Write-Host ""

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Stopping and removing existing task '$TaskName'..." -ForegroundColor Yellow
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "  Old task removed." -ForegroundColor Green
}

# Create the scheduled task action
# Use cmd.exe wrapper to properly pipe output to log file
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$VenvPython`" `"$ServerScript`" >> `"$LogFile`" 2>&1" `
    -WorkingDirectory $ProjectRoot

# Settings: auto-restart on failure, no time limit, ignore new instances
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit 0 `
    -MultipleInstances IgnoreNew

# Run at system startup
$Trigger = New-ScheduledTaskTrigger -AtStartup

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
        -Trigger $Trigger `
        -Principal $Principal `
        -Description "Zyrex File API Server - Serves SFTPGo file listings and download tokens on port 8081" `
        -Force

    Write-Host ""
    Write-Host "  Task '$TaskName' created!" -ForegroundColor Green
    
    # Start the task immediately
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "  Server starting... (check log in 5 seconds)" -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    # Verify it's running
    $taskInfo = Get-ScheduledTask -TaskName $TaskName
    Write-Host ""
    Write-Host "  Status: $($taskInfo.State)" -ForegroundColor $(if($taskInfo.State -eq 'Running'){'Green'}else{'Yellow'})
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Installation Complete!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor White
    Write-Host "    Check status:  Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "    View logs:     type scratch\file_api.log" -ForegroundColor Gray
    Write-Host "    Stop server:   Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "    Start server:  Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
    Write-Host "    Uninstall:     Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
} catch {
    Write-Error "Failed to install scheduled task: $_"
    exit 1
}
