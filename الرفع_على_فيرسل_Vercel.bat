@echo off
@chcp 65001 >nul
title جاري الرفع على Vercel السحابي...
color 0B

echo ======================================================================
echo          🚀 أداة الرفع والتحديث التلقائي على Vercel السحابي
echo          رابط الموقع: https://payroll-erp-rho.vercel.app
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/4] جاري مزامنة ملفات السيرفر وقاعدة البيانات...
call node scripts/sync-server.js
if %errorlevel% neq 0 (
    color 0C
    echo ❌ [خطأ] فشلت مزامنة ملفات السيرفر!
    pause
    exit /b %errorlevel%
)

echo.
echo [2/4] جاري بناء وتجهيز الواجهة للتأكد من عدم وجود أخطاء...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo ❌ [خطأ] فشل بناء الواجهة!
    pause
    exit /b %errorlevel%
)

echo.
echo [3/4] جاري تجهيز التحديث في Git...
git -c http.sslBackend=openssl add .

set /p MSG="📝 أدخل وصف التحديث (أو اضغط Enter لوضع وصف تلقائي): "
if "%MSG%"=="" set MSG=تحديث النظام السحابي بتاريخ %date% %time%

git -c http.sslBackend=openssl commit -m "%MSG%"

echo.
echo [4/4] جاري إرسال التحديث إلى السحابة (GitHub -^> Vercel Deployment)...
git -c http.sslBackend=openssl push origin main
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ❌ [خطأ] فشل إرسال التحديث إلى GitHub! تحقق من اتصال الإنترنت.
    pause
    exit /b %errorlevel%
)

echo.
color 0A
echo ======================================================================
echo  ✅ تم إرسال التحديث بنجاح!
echo  ⚡ منصة Vercel تقوم الآن بتحديث السيرفر السحابي تلقائياً (خلال 30 ثانية).
echo.
echo  🌐 رابط لوحة التحكم الرئيسية:
echo     https://payroll-erp-rho.vercel.app
echo  📱 رابط بوابة الموظف الذكية:
echo     https://payroll-erp-rho.vercel.app/portal
echo  🏢 رابط بوابة مدير المخازن:
echo     https://payroll-erp-rho.vercel.app/warehouse-portal
echo ======================================================================
echo.
pause
