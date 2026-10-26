@echo off
chcp 65001 >nul
title فحص حالة خدمة المزامنة الآلية لماكينات البصمة
color 0B
cd /d "%~dp0"
cls

echo ======================================================================
echo    📊 فحص حالة خدمة المزامنة التلقائية لماكينات البصمة
echo ======================================================================
echo.

set TASK_NAME=PayrollERP_BiometricSync

echo [1] حالة المهمة المجدولة في ويندوز:
echo ----------------------------------------------------------------------
schtasks /query /tn "%TASK_NAME%" /fo TABLE 2>nul
if %ERRORLEVEL% neq 0 (
    color 0E
    echo  ⚠️ المهمة المجدولة غير مثبتة حالياً!
    echo  💡 لتثبيتها وتشغيلها: اضغط دبل كليك على "تثبيت_المزامنة_التلقائية.bat"
)
echo.

echo [2] آخر عمليات مزامنة مسجلة في ملف السجل (logs\biometric-sync.log):
echo ----------------------------------------------------------------------
if exist "logs\biometric-sync.log" (
    powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Path 'logs\biometric-sync.log' -Tail 10 -Encoding UTF8"
) else (
    echo  ℹ️ لا يوجد سجل بعد. سيتم إنشاؤه تلقائياً عند أول دورة مزامنة.
)

echo.
echo ======================================================================
echo  🌐 رابط لوحة المتابعة السحابية:
echo     https://company-payroll-erp-2026.web.app
echo ======================================================================
echo.
pause
