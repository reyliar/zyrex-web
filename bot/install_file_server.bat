@echo off
title Zyrex File API Server - Installer
cd /d "%~dp0"

:: Auto-elevate
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo === Zyrex File API Server Installer ===
echo.
echo Killing old server on port 8081...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081.*LISTENING" 2^>nul') do taskkill /PID %%a /F >nul 2>&1

echo Installing service...
powershell -ExecutionPolicy Bypass -File "%~dp0install_file_server.ps1"
echo.
echo If server is not running, start it manually:
echo   cd ..\.venv\Scripts & python ..\scratch\file_api_server.py
pause

