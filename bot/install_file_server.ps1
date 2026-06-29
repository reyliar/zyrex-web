# Zyrex File API Server Service Installer
# Creates a Windows Scheduled Task to run the file API server at startup
# Run via install_file_server.bat (which auto-elevates and bypasses execution policy)

param(
    [string]$TaskName = "ZyrexFileAPIServer"
)

$ScriptDir = $PSScriptRoot
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ServerScript = Join-Path $ProjectRoot "scratch\file_api_server.py"
$LogFile = Join-Path $ProjectRoot "scratch\file_api.log"
$WrapperScript = Join-Path $ScriptDir "run_file_server.cmd"

# Check Admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run as Administrator! Use install_file_server.bat" -ForegroundColor Red
    exit 1
}

# Validate
if (-not (Test-Path $VenvPython)) { Write-Error "Python not found: $VenvPython"; exit 1 }
if (-not (Test-Path $ServerScript)) { Write-Error "Server script not found: $ServerScript"; exit 1 }

Write-Host "=== Zyrex File API Server Installer ===" -ForegroundColor Cyan
Write-Host "Python : $VenvPython"
Write-Host "Script : $ServerScript"
Write-Host "Log    : $LogFile"

# Create a simple wrapper CMD script that the task will execute
$wrapperContent = @"
@echo off
cd /d "$ProjectRoot"
"$VenvPython" "$ServerScript" >> "$LogFile" 2>&1
"@
Set-Content -Path $WrapperScript -Value $wrapperContent -Encoding ASCII
Write-Host "Wrapper: $WrapperScript"

# Kill any existing Python on port 8081
Write-Host "`nStopping existing server on port 8081..."
$existing = netstat -ano 2>$null | Select-String ":8081.*LISTENING"
if ($existing) {
    $pid = ($existing -split '\s+')[-1]
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Write-Host "  Killed PID $pid"
}

# Remove old task
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create task action using cmd.exe wrapper
$Action = New-ScheduledTaskAction -Execute $WrapperScript -WorkingDirectory $ProjectRoot

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit 0 -MultipleInstances IgnoreNew

$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Settings $Settings `
    -Trigger $Trigger -Principal $Principal -Description "Zyrex File API Server - port 8081" -Force

Write-Host "Task created. Starting..." -ForegroundColor Green
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

$info = Get-ScheduledTask -TaskName $TaskName
Write-Host "Status: $($info.State)" -ForegroundColor $(if($info.State -eq 'Running'){'Green'}else{'Yellow'})
Write-Host "`nDone! Server should be running on port 8081." -ForegroundColor Green
Write-Host "Logs: $LogFile"
