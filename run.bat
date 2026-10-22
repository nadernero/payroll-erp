@echo off
chcp 65001 > nul
title نظام إدارة المرتبات وشؤون العاملين | Payroll ERP
echo =======================================================
echo    نظام إدارة المرتبات وشؤون العاملين (Payroll ERP)
echo =======================================================
echo.
echo جاري تشغيل الخادم والتطبيق المحلي...
echo.
start http://localhost:5000
node server/index.js
pause
