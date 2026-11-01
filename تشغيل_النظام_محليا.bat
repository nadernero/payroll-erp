@echo off
cd /d "%~dp0"
title Payroll ERP - Local Server
echo ======================================================================
echo    Payroll ERP - Starting Local Server...
echo ======================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this computer!
    echo Please download and install Node.js from https://nodejs.org
    echo.
    pause
    exit /b
)

node scripts/start-local.js
pause
