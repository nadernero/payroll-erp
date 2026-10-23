@echo off
@chcp 65001 >nul
title جاري الرفع على Google Firebase...
color 0B

echo ======================================================================
echo          🚀 أداة الرفع والتحديث التلقائي على Google Firebase
echo          رابط الموقع: https://company-payroll-erp-2026.web.app
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] جاري فحص ملفات المشروع...
if not exist "client" (
    color 0C
    echo [خطأ] لم يتم العثور على مجلد client! تأكد من تشغيل الأداة من مجلد المشروع.
    pause
    exit /b 1
)

echo.
echo [2/3] جاري بناء وتجهيز الواجهة (Vite Production Build)...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ❌ [خطأ] فشلت عملية بناء الواجهة (Build Failed)!
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] جاري الرفع السحابي على Google Firebase Hosting...
call npx firebase deploy --only hosting --non-interactive
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ❌ [خطأ] فشلت عملية الرفع على Firebase!
    pause
    exit /b %errorlevel%
)

echo.
color 0A
echo ======================================================================
echo  ✅ تم الرفع والتحديث بنجاح 100%% على Google Firebase!
echo  🌐 رابط الموقع المباشر:
echo     https://company-payroll-erp-2026.web.app
echo  📱 رابط بوابة الموظف:
echo     https://company-payroll-erp-2026.web.app/portal
echo ======================================================================
echo.
pause
