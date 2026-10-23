@echo off
chcp 65001 >nul
echo ============================================================
echo   🚀 جاري بناء ونشر النظام على خوادم Google Firebase...
echo   👉 https://company-payroll-erp-2026.web.app
echo ============================================================

cd /d "%~dp0"

echo ⏳ 1. بناء واجهة التطبيق المحدثة...
call npm --prefix client run build

if %ERRORLEVEL% NEQ 0 (
  echo ❌ فشل بناء الواجهة. يرجى مراجعة الأخطاء.
  pause
  exit /b 1
)

echo.
echo ⏳ 2. النشر المباشر على Google Hosting...
call cmd /c "firebase deploy --only hosting --non-interactive"

if %ERRORLEVEL% NEQ 0 (
  echo ❌ فشل النشر على Google.
  pause
  exit /b 1
)

echo.
echo ⏳ 3. رفع التحديثات إلى مستودع GitHub...
git add .
git commit -m "تحديث ونشر النظام على Google Firebase"
git push origin main

echo.
echo ============================================================
echo   🎉 تم النشر بنجاح 100%% على سيرفرات Google العالمية!
echo   👉 الرابط الدائم: https://company-payroll-erp-2026.web.app
echo ============================================================
pause
