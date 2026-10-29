@echo off
chcp 65001 > nul
title نظام إدارة المرتبات وشؤون العاملين | Payroll ERP
cls
echo =======================================================
echo    نظام إدارة المرتبات وشؤون العاملين (Payroll ERP)
echo =======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] خطأ: برنامج Node.js غير مثبت على هذا الجهاز!
    echo يرجى تحميل وتثبيت Node.js من: https://nodejs.org
    pause
    exit /b
)

if not exist "node_modules\" (
    echo [*] تثبيت مكتبات النظام (npm install)...
    call npm install
)

if not exist "client\dist\" (
    echo [*] بناء واجهة المستخدم (npm run build)...
    call npm run build
)

echo جاري تشغيل الخادم والتطبيق المحلي...
echo.
start http://localhost:5000
node server/index.js
pause
