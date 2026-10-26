@echo off
chcp 65001 >nul
title فحص حالة خدمة المزامنة الآلية لماكينات البصمة
color 0B
cd /d "%~dp0"
cls

if not exist "%~dp0scripts\show-status.js" (
    color 0C
    echo.
    echo ======================================================================
    echo  [X] Error: Missing project files!
    echo  يرجى نقل مجلد المشروع كاملاً وليس هذا الملف بمفرده.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

call node scripts/show-status.js --open

echo.
pause
