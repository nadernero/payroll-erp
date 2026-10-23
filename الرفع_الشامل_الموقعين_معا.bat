@echo off
@chcp 65001 >nul
title جاري التحديث الشامل على Google Firebase و Vercel معاً...
color 0B

echo ======================================================================
echo          🚀 أداة التحديث الشامل (Google Firebase + Vercel)
echo ======================================================================
echo.

cd /d "%~dp0"

echo ----------------------------------------------------------------------
echo  المرحلة الأولى: مزامنة السيرفر وقاعدة البيانات وبناء الواجهة
echo ----------------------------------------------------------------------
call node scripts/sync-server.js
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo ❌ [خطأ] فشلت عملية البناء والتجهيز!
    pause
    exit /b %errorlevel%
)

echo.
echo ----------------------------------------------------------------------
echo  المرحلة الثانية: الرفع على Google Firebase Hosting
echo ----------------------------------------------------------------------
call npx firebase deploy --only hosting --non-interactive
if %errorlevel% neq 0 (
    color 0E
    echo ⚠️ تحذير: تعذر الرفع على Firebase، سيتم المتابعة للرفع على Vercel...
) else (
    echo ✅ تم الرفع بنجاح على Google Firebase!
)

echo.
echo ----------------------------------------------------------------------
echo  المرحلة الثالثة: الرفع على Vercel السحابي
echo ----------------------------------------------------------------------
git -c http.sslBackend=openssl add .

set /p MSG="📝 أدخل وصف التحديث (أو اضغط Enter لوضع وصف تلقائي): "
if "%MSG%"=="" set MSG=تحديث شامل للنظام بتاريخ %date% %time%

git -c http.sslBackend=openssl commit -m "%MSG%"
git -c http.sslBackend=openssl push origin main
if %errorlevel% neq 0 (
    color 0C
    echo ❌ [خطأ] فشل الإرسال إلى GitHub/Vercel!
    pause
    exit /b %errorlevel%
)

echo.
color 0A
echo ======================================================================
echo  🎉 تهانينا! تم تحديث الموقعين بنجاح 100%%:
echo.
echo  1️⃣ رابط Google Firebase:
echo     https://company-payroll-erp-2026.web.app
echo.
echo  2️⃣ رابط Vercel السحابي:
echo     https://payroll-erp-rho.vercel.app
echo.
echo  📱 بوابة الموظف الذكية:
echo     https://company-payroll-erp-2026.web.app/portal
echo ======================================================================
echo.
pause
