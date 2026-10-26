@echo off
chcp 65001 >nul
title تثبيت خدمة المزامنة الآلية لماكينات البصمة (Windows Task Scheduler)
color 0B
cd /d "%~dp0"
cls

call node scripts/install-sync.js

echo.
pause
