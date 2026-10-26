@echo off
chcp 65001 >nul
title فحص حالة خدمة المزامنة الآلية لماكينات البصمة
color 0B
cd /d "%~dp0"
cls

call node scripts/show-status.js --open

echo.
pause
