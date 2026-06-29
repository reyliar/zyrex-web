@echo off
title Zyrex File API Server - Service Installer
cd /d "%~dp0"

:: Auto-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs -Wait"
    exit /b
)

echo ============================================
echo   Zyrex File API Server - Service Installer
echo ============================================
echo.

:: Kill any existing Python server on port 8081
echo Stopping any existing server on port 8081...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081.*LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo.

:: Install the scheduled task
echo Installing Windows Scheduled Task...
powershell -ExecutionPolicy Bypass -File "%~dp0install_file_server.ps1" -TaskName "ZyrexFileAPIServer"

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   Installation Complete!
    echo ============================================
    echo   Server is now running on port 8081
    echo   It will auto-start at every system boot
    echo   Log: scratch\file_api.log
    echo.
    echo   Check status: powershell -c "Get-ScheduledTask -TaskName 'ZyrexFileAPIServer' ^| Select State"
    echo.
) else (
    echo.
    echo INSTALLATION FAILED! Run PowerShell as Administrator and try again.
    echo Or run: powershell -ExecutionPolicy Bypass -File "%~dp0install_file_server.ps1"
)
pause
