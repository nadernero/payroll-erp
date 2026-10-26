@echo off
chcp 65001 >nul
title Uninstall Payroll ERP Auto-Sync Service
color 0C
cd /d "%~dp0"
cls

echo ======================================================================
echo    Payroll ERP - Uninstall Biometric Auto-Sync Service
echo ======================================================================
echo.

set TASK_NAME=PayrollERP_BiometricSync

echo Removing Windows Scheduled Task "%TASK_NAME%"...
schtasks /delete /tn "%TASK_NAME%" /f

if %ERRORLEVEL% equ 0 (
    color 0A
    echo.
    echo ======================================================================
    echo  [OK] Auto-Sync Service removed successfully!
    echo ======================================================================
) else (
    echo.
    echo  [i] Task is not currently installed or already removed.
)

echo.
pause
