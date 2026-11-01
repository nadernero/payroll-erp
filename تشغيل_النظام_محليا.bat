@echo off
chcp 65001 > nul
title نظام إدارة المرتبات وشؤون العاملين - التشغيل المحلي
cls
echo ======================================================================
echo           🚀 نظام إدارة المرتبات وشؤون العاملين (Payroll ERP)
echo                    التشغيل المحلي على جهاز الكمبيوتر
echo ======================================================================
echo.

:: 1. التحقق من تثبيت Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] خطأ: برنامج Node.js غير مثبت على هذا الجهاز!
    echo يرجى تحميل وتثبيت Node.js من الموقع الرسمي: https://nodejs.org
    echo بعد التثبيت، أعد تشغيل هذا الملف.
    echo.
    pause
    exit /b
)

:: 2. تحرير المنفذ 5000 من أي سيرفر سابق معلق
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo [*] إغلاق جلسة تشغيل سابقة معلقة على المنفذ 5000...
    taskkill /F /PID %%a >nul 2>nul
)

:: 3. التحقق من اكتمال مكتبات النظام (node_modules)
set NEED_INSTALL=0
if not exist "node_modules\" (
    set NEED_INSTALL=1
) else (
    node -e "require('express'); require('exceljs');" >nul 2>nul
    if %errorlevel% neq 0 (
        set NEED_INSTALL=1
    )
)

if "%NEED_INSTALL%"=="1" (
    echo [*] جاري تثبيت واستكمال حزم النظام لأول مرة (npm install)...
    echo يرجى الانتظار، قد يستغرق ذلك دقيقة أو دقيقتين...
    call npm install
    echo.
)

:: 4. التحقق من وجود ملفات الواجهة (client/dist)
if not exist "client\dist\index.html" (
    if not exist "dist\index.html" (
        echo [*] جاري تجهيز واجهة المستخدم لأول مرة (npm run build)...
        call npm run build
        echo.
    )
)

:: 5. تشغيل السيرفر (يقوم السيرفر بفتح المتصفح تلقائياً عند جاهزية المنفذ)
echo ======================================================================
echo  ✅ جاري بدء تشغيل النظام...
echo  🌐 سيتم فتح المتصفح تلقائياً بمجرد اكتمال التشغيل!
echo  ⚠️  تنبيه: اترك هذه النافذة السوداء مفتوحة أثناء العمل على النظام.
echo ======================================================================
echo.

node server/index.js

echo.
echo [!] تم إيقاف الخادم المحلي.
pause
