@echo off
chcp 65001 >nul
title تثبيت خدمة المزامنة الآلية لماكينات البصمة (Windows Task Scheduler)
color 0B
cd /d "%~dp0"
cls

if not exist "%~dp0scripts\install-sync.js" (
    color 0C
    echo.
    echo ======================================================================
    echo  [X] Error: Missing project files!
    echo ======================================================================
    echo.
    echo  You copied this .bat file alone!
    echo  Please copy the complete "ERP" folder to this PC, then run this file.
    echo.
    echo  خطأ: قمت بنسخ هذا الملف بمفرده!
    echo  للتشغيل على جهاز آخر: انسخ مجلد المشروع بالكامل ثم شغل هذا الملف من داخله.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

call node scripts/install-sync.js

echo.
pause
