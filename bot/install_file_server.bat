@echo off
echo Installing Zyrex File API Server as Windows Service...
echo This requires Administrator privileges.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0install_file_server.ps1"
pause
